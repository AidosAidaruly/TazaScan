import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/features/product_submission/data/repositories/http_product_submission_repository.dart';
import 'package:project/src/features/product_submission/domain/entities/product_submission_draft.dart';
import 'package:project/src/features/product_submission/domain/repositories/product_submission_repository.dart';

class ProductSubmissionScreen extends StatefulWidget {
  const ProductSubmissionScreen({
    this.initialBarcode,
    this.repository,
    super.key,
  });

  final String? initialBarcode;
  final ProductSubmissionRepository? repository;

  @override
  State<ProductSubmissionScreen> createState() =>
      _ProductSubmissionScreenState();
}

class _ProductSubmissionScreenState extends State<ProductSubmissionScreen> {
  final _picker = ImagePicker();
  final _formKey = GlobalKey<FormState>();
  final _controllers = <String, TextEditingController>{};

  String _servingType = 'per100g';
  XFile? _frontImage;
  XFile? _ingredientsImage;
  XFile? _nutritionImage;
  XFile? _barcodeImage;
  bool _isSubmitting = false;
  bool _isSuccess = false;
  String? _errorMessage;
  String? _ocrMessage;
  String? _ocrErrorMessage;
  String? _processingOcr;
  final _ocrPopulatedValues = <String, String>{};
  String? _ocrPopulatedIngredients;

  bool get _isUnknownBarcodeFlow =>
      (widget.initialBarcode ?? '').trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    for (final key in _fieldNames) {
      _controllers[key] = TextEditingController();
    }
    _controllers['barcode']!.text = widget.initialBarcode ?? '';
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickImage(String key) async {
    final image = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
      maxWidth: 1600,
    );
    if (image == null) return;

    setState(() {
      switch (key) {
        case 'front':
          _frontImage = image;
        case 'ingredients':
          _ingredientsImage = image;
        case 'nutrition':
          _nutritionImage = image;
        case 'barcode':
          _barcodeImage = image;
      }
    });

    if (key == 'nutrition') {
      await _recognizeNutrition(image);
    } else if (key == 'ingredients') {
      await _recognizeIngredients(image);
    }
  }

  Future<void> _recognizeNutrition(XFile image) async {
    setState(() {
      _processingOcr = 'nutrition';
      _ocrMessage = context.t.pick(
        ru: 'Распознаём пищевую ценность...',
        kk: 'Тағамдық құндылық анықталуда...',
      );
      _ocrErrorMessage = null;
    });

    try {
      final result =
          await (widget.repository ?? const HttpProductSubmissionRepository())
              .recognizeNutrition(image);
      if (!mounted) return;

      var filledCount = 0;
      for (final entry in result.nutrition.entries) {
        final value = entry.value.value;
        if (value == null) {
          continue;
        }

        if (_applyOcrValue(entry.key, _formatOcrNumber(value))) {
          filledCount += 1;
        }
      }

      if (result.detectedBasis == 'per100g' || result.detectedBasis == 'per100ml') {
        setState(() {
          _servingType = result.detectedBasis;
        });
      }

      setState(() {
        _ocrMessage = filledCount > 0
            ? context.t.pick(
                ru:
                    'Данные распознаны с фото. Проверьте их перед отправкой.',
                kk:
                    'Деректер фотодан анықталды. Жібермес бұрын тексеріңіз.',
              )
            : context.t.pick(
                ru: 'Некоторые поля не распознаны — их можно оставить пустыми.',
                kk: 'Кейбір өрістер анықталмады — оларды бос қалдыруға болады.',
              );
        _ocrErrorMessage = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _ocrErrorMessage = _ocrErrorText(error));
    } finally {
      if (mounted) {
        setState(() => _processingOcr = null);
      }
    }
  }

  Future<void> _recognizeIngredients(XFile image) async {
    setState(() {
      _processingOcr = 'ingredients';
      _ocrMessage = context.t.pick(
        ru: 'Распознаём состав...',
        kk: 'Құрамы анықталуда...',
      );
      _ocrErrorMessage = null;
    });

    try {
      final result =
          await (widget.repository ?? const HttpProductSubmissionRepository())
              .recognizeIngredients(image);
      if (!mounted) return;

      final value = result.value?.trim();
      final applied = value != null && value.isNotEmpty && _applyIngredientsOcr(value);

      setState(() {
        _ocrMessage = applied
            ? context.t.pick(
                ru: 'Состав распознан с фото. Проверьте текст перед отправкой.',
                kk: 'Құрамы фотодан анықталды. Жібермес бұрын мәтінді тексеріңіз.',
              )
            : context.t.pick(
                ru:
                    'Состав не распознан — его можно оставить пустым или заполнить вручную.',
                kk:
                    'Құрамы анықталмады — оны бос қалдыруға немесе қолмен толтыруға болады.',
              );
        _ocrErrorMessage = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _ocrErrorMessage = _ocrErrorText(error));
    } finally {
      if (mounted) {
        setState(() => _processingOcr = null);
      }
    }
  }

  bool _applyOcrValue(String key, String value) {
    final controller = _controllers[key];
    if (controller == null) {
      return false;
    }

    final current = controller.text.trim();
    final previousOcrValue = _ocrPopulatedValues[key];
    if (current.isNotEmpty && current != previousOcrValue) {
      return false;
    }

    controller.text = value;
    _ocrPopulatedValues[key] = value;
    return true;
  }

  bool _applyIngredientsOcr(String value) {
    final controller = _controllers['ingredients']!;
    final current = controller.text.trim();
    if (current.isNotEmpty && current != _ocrPopulatedIngredients) {
      return false;
    }

    controller.text = value;
    _ocrPopulatedIngredients = value;
    return true;
  }

  String _formatOcrNumber(double value) {
    if (value == value.roundToDouble()) {
      return value.toInt().toString();
    }

    return value.toString();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final draft = _draft();
    if (!draft.hasIdentifyingData) {
      _showError(
        context.t.pick(
          ru: 'Добавь штрихкод, название продукта или фото упаковки.',
          kk: 'Штрихкодты, өнім атауын немесе қаптама фотосын қосыңыз.',
        ),
      );
      return;
    }

    if (_isUnknownBarcodeFlow && !draft.hasFrontPackagePhoto) {
      _showError(
        context.t.pick(
          ru:
              'Добавь фото лицевой стороны упаковки, чтобы модератор проверил продукт.',
          kk:
              'Модератор өнімді тексеруі үшін қаптаманың алдыңғы жағының фотосын қосыңыз.',
        ),
      );
      return;
    }

    final confirmed = await _confirmSubmission(draft);
    if (confirmed != true) {
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      await (widget.repository ?? const HttpProductSubmissionRepository())
          .submit(draft);
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _isSuccess = true;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
      });
      _showError(_submitErrorText(error));
    }
  }

  /// OCR failure text; specific for busy/timeout/limits, never backend text.
  String _ocrErrorText(Object error) {
    final t = context.t;
    final manualHint = t.pick(
      ru: 'Можно заполнить поля вручную или сделать другое фото.',
      kk: 'Өрістерді қолмен толтыруға немесе басқа фото түсіруге болады.',
    );

    if (error is ServerException &&
        const {
          ApiErrorKind.ocrBusy,
          ApiErrorKind.ocrTimeout,
          ApiErrorKind.rateLimited,
          ApiErrorKind.payloadTooLarge,
        }.contains(error.kind)) {
      return '${t.apiErrorMessage(error.kind)} $manualHint';
    }
    if (error is RequestTimeoutException) {
      return '${t.apiErrorMessage(ApiErrorKind.ocrTimeout)} $manualHint';
    }
    if (error is NetworkException) {
      return '${t.checkConnectionAndRetry} $manualHint';
    }

    return '${t.cannotOpenImage}. $manualHint';
  }

  /// Submission failure text: connection problems and HTTP failures stay distinguishable.
  String _submitErrorText(Object error) {
    final t = context.t;

    if (error is ServerException) {
      return t.apiErrorMessage(error.kind);
    }
    if (error is RequestTimeoutException) {
      return '${t.serverSlow}. ${t.tryAgain}';
    }
    if (error is NetworkException) {
      return t.checkConnectionAndRetry;
    }

    return t.pick(
      ru: 'Не удалось отправить продукт. Попробуйте снова.',
      kk: 'Өнімді жіберу мүмкін болмады. Қайта көріңіз.',
    );
  }

  void _showError(String message) {
    if (!mounted) return;
    setState(() => _errorMessage = message);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  ProductSubmissionDraft _draft() {
    return ProductSubmissionDraft(
      barcode: _text('barcode'),
      name: _text('name'),
      brand: _text('brand'),
      category: _text('category'),
      ingredients: _text('ingredients'),
      servingType: _servingType,
      energyKcal: _text('energyKcal'),
      protein: _text('protein'),
      carbohydrates: _text('carbohydrates'),
      sugars: _text('sugars'),
      fat: _text('fat'),
      saturatedFat: _text('saturatedFat'),
      fiber: _text('fiber'),
      salt: _text('salt'),
      frontImage: _frontImage,
      ingredientsImage: _ingredientsImage,
      nutritionImage: _nutritionImage,
      barcodeImage: _barcodeImage,
    );
  }

  String _text(String key) => _controllers[key]!.text;

  Future<bool?> _confirmSubmission(ProductSubmissionDraft draft) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.t.submitForReviewQuestion),
        content: Text(
          [
            if (draft.barcode.isNotEmpty)
              '${context.t.pick(ru: 'Штрихкод', kk: 'Штрихкод')}: ${draft.barcode}',
            if (draft.name.isNotEmpty)
              '${context.t.pick(ru: 'Название', kk: 'Атауы')}: ${draft.name}',
            if (draft.brand.isNotEmpty)
              '${context.t.pick(ru: 'Бренд', kk: 'Бренд')}: ${draft.brand}',
            '${context.t.pick(ru: 'Фото', kk: 'Фото')}: ${[
              draft.frontImage,
              draft.ingredientsImage,
              draft.nutritionImage,
              draft.barcodeImage,
            ].where((image) => image != null).length}',
          ].join('\n'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(context.t.edit),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(context.t.submit),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isSuccess) {
      return Scaffold(
        appBar: AppBar(title: Text(context.t.submittedTitle)),
        body: ResponsivePage(
          child: Center(
            child: Text(context.t.submittedMessage),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(context.t.addProductTitle)),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: _isSubmitting ? null : _submit,
          child: Text(_isSubmitting ? context.t.submitting : context.t.checkAndSubmit),
        ),
      ),
      body: ResponsivePage(
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              Text(
                context.t.pick(
                  ru:
                      'Фото лицевой стороны обязательно для продукта, найденного по неизвестному штрихкоду. Данные с этикетки можно добавить вручную, неизвестные поля оставь пустыми.',
                  kk:
                      'Белгісіз штрихкод бойынша табылған өнім үшін қаптаманың алдыңғы жағының фотосы міндетті. Жапсырма деректерін қолмен қосуға болады, белгісіз өрістерді бос қалдырыңыз.',
                ),
              ),
              if (_processingOcr != null) ...[
                const SizedBox(height: 12),
                const LinearProgressIndicator(),
                const SizedBox(height: 8),
                Text(_ocrMessage ?? context.t.recognizingData),
              ] else if (_ocrMessage != null) ...[
                const SizedBox(height: 12),
                Text(_ocrMessage!),
              ],
              if (_ocrErrorMessage != null) ...[
                const SizedBox(height: 12),
                Text(
                  _ocrErrorMessage!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 16),
              _TextInput(
                controller: _controllers['barcode']!,
                label: context.t.pick(ru: 'Штрихкод', kk: 'Штрихкод'),
              ),
              _TextInput(
                controller: _controllers['name']!,
                label: context.t.pick(ru: 'Название продукта', kk: 'Өнім атауы'),
              ),
              _TextInput(
                controller: _controllers['brand']!,
                label: context.t.pick(ru: 'Бренд', kk: 'Бренд'),
              ),
              _TextInput(
                controller: _controllers['category']!,
                label: context.t.pick(ru: 'Категория', kk: 'Санат'),
              ),
              _TextInput(
                controller: _controllers['ingredients']!,
                label: context.t.ingredients,
                maxLines: 4,
              ),
              DropdownButtonFormField<String>(
                initialValue: _servingType,
                decoration: InputDecoration(labelText: context.t.portionType),
                items: [
                  DropdownMenuItem(value: 'per100g', child: Text(context.t.per100g)),
                  DropdownMenuItem(value: 'per100ml', child: Text(context.t.per100ml)),
                ],
                onChanged: (value) =>
                    setState(() => _servingType = value ?? 'per100g'),
              ),
              const SizedBox(height: 12),
              for (final field in _nutritionFields)
                _TextInput(
                  controller: _controllers[field.key]!,
                  label: field.label(context),
                  keyboardType: TextInputType.number,
                ),
              const SizedBox(height: 12),
              _PhotoButton(
                label: context.t.packagePhoto,
                image: _frontImage,
                onTap: () => _pickImage('front'),
              ),
              _PhotoButton(
                label: context.t.ingredientsPhoto,
                hint: context.t.pick(
                  ru: 'Сфотографируйте состав крупно, чтобы текст был читаемым.',
                  kk: 'Мәтін оқылуы үшін құрамды жақыннан түсіріңіз.',
                ),
                image: _ingredientsImage,
                onTap: () => _pickImage('ingredients'),
                isProcessing: _processingOcr == 'ingredients',
              ),
              _PhotoButton(
                label: context.t.nutritionPhoto,
                hint: context.t.pick(
                  ru:
                      'Сфотографируйте таблицу пищевой ценности крупно, без бликов.',
                  kk:
                      'Тағамдық құндылық кестесін жарқылсыз, жақыннан түсіріңіз.',
                ),
                image: _nutritionImage,
                onTap: () => _pickImage('nutrition'),
                isProcessing: _processingOcr == 'nutrition',
              ),
              _PhotoButton(
                label: context.t.barcodePhoto,
                image: _barcodeImage,
                onTap: () => _pickImage('barcode'),
              ),
              if (_errorMessage != null) ...[
                const SizedBox(height: 12),
                Text(
                  _errorMessage!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 16),
              if (_isSubmitting) const LinearProgressIndicator(),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _TextInput extends StatelessWidget {
  const _TextInput({
    required this.controller,
    required this.label,
    this.maxLines = 1,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String label;
  final int maxLines;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextFormField(
        controller: controller,
        decoration: InputDecoration(labelText: label),
        maxLines: maxLines,
        keyboardType: keyboardType,
      ),
    );
  }
}

class _PhotoButton extends StatelessWidget {
  const _PhotoButton({
    required this.label,
    required this.image,
    required this.onTap,
    this.hint,
    this.isProcessing = false,
  });

  final String label;
  final String? hint;
  final XFile? image;
  final VoidCallback onTap;
  final bool isProcessing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          OutlinedButton.icon(
            onPressed: isProcessing ? null : onTap,
            icon: Icon(
              isProcessing
                  ? Icons.hourglass_top_rounded
                  : Icons.photo_camera_rounded,
            ),
            label: Text(
              isProcessing
                  ? context.t.pick(
                      ru: '$label: распознаём...',
                      kk: '$label: анықталуда...',
                    )
                  : image == null
                      ? label
                      : context.t.pick(
                          ru: '$label выбрано',
                          kk: '$label таңдалды',
                        ),
            ),
          ),
          if (hint != null) ...[
            const SizedBox(height: 4),
            Text(
              hint!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

const _fieldNames = [
  'barcode',
  'name',
  'brand',
  'category',
  'ingredients',
  'energyKcal',
  'protein',
  'carbohydrates',
  'sugars',
  'fat',
  'saturatedFat',
  'fiber',
  'salt',
];

const _nutritionFields = [
  _NutritionField('energyKcal'),
  _NutritionField('protein'),
  _NutritionField('carbohydrates'),
  _NutritionField('sugars'),
  _NutritionField('fat'),
  _NutritionField('saturatedFat'),
  _NutritionField('fiber'),
  _NutritionField('salt'),
];

class _NutritionField {
  const _NutritionField(this.key);

  final String key;

  String label(BuildContext context) {
    return switch (key) {
      'energyKcal' => context.t.pick(ru: 'Ккал', kk: 'Ккал'),
      'protein' => context.t.protein,
      'carbohydrates' => context.t.carbohydrates,
      'sugars' => context.t.sugars,
      'fat' => context.t.fat,
      'saturatedFat' => context.t.saturatedFat,
      'fiber' => context.t.fiber,
      'salt' => context.t.salt,
      _ => key,
    };
  }
}
