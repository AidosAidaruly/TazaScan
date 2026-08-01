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
  State<ProductSubmissionScreen> createState() => _ProductSubmissionScreenState();
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
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final draft = _draft();
    if (!draft.hasIdentifyingData) {
      _showError('Add barcode, product name, or front photo.');
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
      await (widget.repository ?? const HttpProductSubmissionRepository()).submit(draft);
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
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
        title: const Text('Submit for review?'),
        content: Text(
          [
            if (draft.barcode.isNotEmpty) 'Barcode: ${draft.barcode}',
            if (draft.name.isNotEmpty) 'Name: ${draft.name}',
            if (draft.brand.isNotEmpty) 'Brand: ${draft.brand}',
            'Photos: ${[
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
            child: const Text('Edit'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isSuccess) {
      return Scaffold(
        appBar: AppBar(title: const Text('Submission sent')),
        body: const ResponsivePage(
          child: Center(
            child: Text('Thank you. Your product was sent for moderation.'),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Help add this product')),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: _isSubmitting ? null : _submit,
          child: Text(_isSubmitting ? 'Submitting...' : 'Review and submit'),
        ),
      ),
      body: ResponsivePage(
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              const Text('Photos are more important than guessed values.'),
              const SizedBox(height: 16),
              _TextInput(controller: _controllers['barcode']!, label: 'Barcode'),
              _TextInput(controller: _controllers['name']!, label: 'Product name'),
              _TextInput(controller: _controllers['brand']!, label: 'Brand'),
              _TextInput(controller: _controllers['category']!, label: 'Category'),
              _TextInput(
                controller: _controllers['ingredients']!,
                label: 'Ingredients',
                maxLines: 4,
              ),
              DropdownButtonFormField<String>(
                initialValue: _servingType,
                decoration: const InputDecoration(labelText: 'Serving type'),
                items: const [
                  DropdownMenuItem(value: 'per100g', child: Text('per100g')),
                  DropdownMenuItem(value: 'per100ml', child: Text('per100ml')),
                ],
                onChanged: (value) => setState(() => _servingType = value ?? 'per100g'),
              ),
              const SizedBox(height: 12),
              for (final field in _nutritionFields)
                _TextInput(
                  controller: _controllers[field.key]!,
                  label: field.label,
                  keyboardType: TextInputType.number,
                ),
              const SizedBox(height: 12),
              _PhotoButton(label: 'Front package photo', image: _frontImage, onTap: () => _pickImage('front')),
              _PhotoButton(label: 'Ingredients photo', image: _ingredientsImage, onTap: () => _pickImage('ingredients')),
              _PhotoButton(label: 'Nutrition label photo', image: _nutritionImage, onTap: () => _pickImage('nutrition')),
              _PhotoButton(label: 'Barcode photo', image: _barcodeImage, onTap: () => _pickImage('barcode')),
              if (_errorMessage != null) ...[
                const SizedBox(height: 12),
                Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
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
  const _PhotoButton({required this.label, required this.image, required this.onTap});

  final String label;
  final XFile? image;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: const Icon(Icons.photo_camera_rounded),
        label: Text(image == null ? label : '$label selected'),
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
  _NutritionField('energyKcal', 'Energy kcal'),
  _NutritionField('protein', 'Protein'),
  _NutritionField('carbohydrates', 'Carbohydrates'),
  _NutritionField('sugars', 'Sugars'),
  _NutritionField('fat', 'Fat'),
  _NutritionField('saturatedFat', 'Saturated fat'),
  _NutritionField('fiber', 'Fiber'),
  _NutritionField('salt', 'Salt'),
];

class _NutritionField {
  const _NutritionField(this.key, this.label);

  final String key;
  final String label;
}
