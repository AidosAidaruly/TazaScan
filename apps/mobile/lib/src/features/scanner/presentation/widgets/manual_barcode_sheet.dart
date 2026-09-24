import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/features/scanner/domain/barcode_validator.dart';

/// A modal bottom sheet for typing a barcode by hand. Returns the validated,
/// trimmed barcode string via [Navigator.pop] on submit, or `null` if
/// dismissed. Purely a UI/validation surface: the caller is responsible for
/// running the resulting barcode through the same lookup flow used after a
/// camera detection.
class ManualBarcodeSheet extends StatefulWidget {
  const ManualBarcodeSheet({super.key});

  @override
  State<ManualBarcodeSheet> createState() => _ManualBarcodeSheetState();
}

class _ManualBarcodeSheetState extends State<ManualBarcodeSheet> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  String? _errorText;

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _controller.text.trim();

    if (!BarcodeValidator.isValidManualBarcode(value)) {
      setState(() {
        _errorText = context.t.pick(
          ru: 'Проверьте штрихкод: допустимая длина — 8, 12 или 13 цифр.',
          kk: 'Штрихкодты тексеріңіз: рұқсат етілген ұзындық — 8, 12 немесе 13 сан.',
        );
      });
      return;
    }

    FocusScope.of(context).unfocus();
    Navigator.of(context).pop(value);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final t = context.t;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 18),
                    decoration: BoxDecoration(
                      color: colorScheme.onSurfaceVariant.withValues(
                        alpha: 0.3,
                      ),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        t.pick(
                          ru: 'Введите штрихкод',
                          kk: 'Штрихкодты енгізіңіз',
                        ),
                        style: textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                      tooltip: t.pick(ru: 'Закрыть', kk: 'Жабу'),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  t.pick(
                    ru: 'Введите EAN или UPC с упаковки продукта',
                    kk: 'Өнім қаптамасындағы EAN немесе UPC кодын енгізіңіз',
                  ),
                  style: textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: _controller,
                  focusNode: _focusNode,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.done,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  maxLength: 13,
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                  decoration: InputDecoration(
                    hintText: '5449000000996',
                    counterText: '',
                    errorText: _errorText,
                    filled: true,
                    fillColor: colorScheme.surfaceContainerHighest,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide(
                        color: colorScheme.primary,
                        width: 1.5,
                      ),
                    ),
                  ),
                  onChanged: (_) {
                    if (_errorText != null) {
                      setState(() => _errorText = null);
                    }
                  },
                  onSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: _submit,
                  child: Text(
                    t.pick(ru: 'Найти продукт', kk: 'Өнімді табу'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
