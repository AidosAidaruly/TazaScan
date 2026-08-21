import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:project/src/core/errors/app_exception.dart';
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
      _ocrMessage = 'Распознаём пищевую ценность...';
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
            ? 'Данные распознаны с фото. Проверьте их перед отправкой.'
            : 'Некоторые поля не распознаны — их можно оставить пустыми.';
        _ocrErrorMessage = null;
      });
    } on AppException catch (error) {
      if (!mounted) return;
      setState(() {
        _ocrErrorMessage =
            '${error.message} Можно заполнить поля вручную или сделать другое фото.';
      });
    } finally {
      if (mounted) {
        setState(() => _processingOcr = null);
      }
    }
  }

  Future<void> _recognizeIngredients(XFile image) async {
    setState(() {
      _processingOcr = 'ingredients';
      _ocrMessage = 'Распознаём состав...';
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
            ? 'Состав распознан с фото. Проверьте текст перед отправкой.'
            : 'Состав не распознан — его можно оставить пустым или заполнить вручную.';
        _ocrErrorMessage = null;
      });
    } on AppException catch (error) {
      if (!mounted) return;
      setState(() {
        _ocrErrorMessage =
            '${error.message} Можно заполнить поля вручную или сделать другое фото.';
      });
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
      _showError('Добавь штрихкод, название продукта или фото упаковки.');
      return;
    }

    if (_isUnknownBarcodeFlow && !draft.hasFrontPackagePhoto) {
      _showError(
        'Добавь фото лицевой стороны упаковки, чтобы модератор проверил товар.',
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
    } on AppException catch (error) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
      });
      _showError(error.message);
    }
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
        title: const Text('Отправить на проверку?'),
        content: Text(
          [
            if (draft.barcode.isNotEmpty) 'Штрихкод: ${draft.barcode}',
            if (draft.name.isNotEmpty) 'Название: ${draft.name}',
            if (draft.brand.isNotEmpty) 'Бренд: ${draft.brand}',
            'Фото: ${[
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
            child: const Text('Изменить'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Отправить'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isSuccess) {
      return Scaffold(
        appBar: AppBar(title: const Text('Заявка отправлена')),
        body: const ResponsivePage(
          child: Center(
            child: Text('Спасибо. Продукт отправлен на модерацию.'),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Добавить продукт')),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: _isSubmitting ? null : _submit,
          child: Text(_isSubmitting ? 'Отправляем...' : 'Проверить и отправить'),
        ),
      ),
      body: ResponsivePage(
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              const Text(
                'Фото лицевой стороны обязательно для товара, найденного по неизвестному штрихкоду. Данные с этикетки можно добавить вручную, неизвестные поля оставь пустыми.',
              ),
              if (_processingOcr != null) ...[
                const SizedBox(height: 12),
                const LinearProgressIndicator(),
                const SizedBox(height: 8),
                Text(_ocrMessage ?? 'Распознаём данные...'),
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
                label: 'Штрихкод',
              ),
              _TextInput(
                controller: _controllers['name']!,
                label: 'Название продукта',
              ),
              _TextInput(controller: _controllers['brand']!, label: 'Бренд'),
              _TextInput(
                controller: _controllers['category']!,
                label: 'Категория',
              ),
              _TextInput(
                controller: _controllers['ingredients']!,
                label: 'Состав',
                maxLines: 4,
              ),
              DropdownButtonFormField<String>(
                initialValue: _servingType,
                decoration: const InputDecoration(labelText: 'Тип порции'),
                items: const [
                  DropdownMenuItem(value: 'per100g', child: Text('на 100 г')),
                  DropdownMenuItem(value: 'per100ml', child: Text('на 100 мл')),
                ],
                onChanged: (value) =>
                    setState(() => _servingType = value ?? 'per100g'),
              ),
              const SizedBox(height: 12),
              for (final field in _nutritionFields)
                _TextInput(
                  controller: _controllers[field.key]!,
                  label: field.label,
                  keyboardType: TextInputType.number,
                ),
              const SizedBox(height: 12),
              _PhotoButton(
                label: 'Фото лицевой стороны',
                image: _frontImage,
                onTap: () => _pickImage('front'),
              ),
              _PhotoButton(
                label: 'Фото состава',
                hint:
                    'Сфотографируйте состав крупно, чтобы текст был читаемым.',
                image: _ingredientsImage,
                onTap: () => _pickImage('ingredients'),
                isProcessing: _processingOcr == 'ingredients',
              ),
              _PhotoButton(
                label: 'Фото пищевой ценности',
                hint:
                    'Сфотографируйте таблицу пищевой ценности крупно, без бликов.',
                image: _nutritionImage,
                onTap: () => _pickImage('nutrition'),
                isProcessing: _processingOcr == 'nutrition',
              ),
              _PhotoButton(
                label: 'Фото штрихкода',
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
                  ? '$label: распознаём...'
                  : image == null
                      ? label
                      : '$label выбрано',
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
  _NutritionField('energyKcal', 'Ккал'),
  _NutritionField('protein', 'Белки'),
  _NutritionField('carbohydrates', 'Углеводы'),
  _NutritionField('sugars', 'Сахар'),
  _NutritionField('fat', 'Жиры'),
  _NutritionField('saturatedFat', 'Насыщенные жиры'),
  _NutritionField('fiber', 'Клетчатка'),
  _NutritionField('salt', 'Соль'),
];

class _NutritionField {
  const _NutritionField(this.key, this.label);

  final String key;
  final String label;
}
