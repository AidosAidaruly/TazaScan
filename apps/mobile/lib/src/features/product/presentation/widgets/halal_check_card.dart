import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/halal_check.dart';

class HalalCheckCard extends StatelessWidget {
  const HalalCheckCard({required this.halalCheck, super.key});

  final HalalCheck? halalCheck;

  @override
  Widget build(BuildContext context) {
    final check = halalCheck;
    final status = check?.status ?? HalalCheckStatus.insufficientData;
    final screeningStatus =
        check?.ingredientScreeningStatus ??
        HalalIngredientScreeningStatus.insufficientData;
    final color = _statusColor(status);
    final statusIcon = _statusIcon(status);
    final reasons = check?.reasons ?? const <String>[];
    final signals = check?.matchedSignals ?? const <HalalMatchedSignal>[];
    final certificationStatus = check?.certificationStatus ?? 'not_verified';

    return TazaCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(statusIcon, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.t.halalCheck,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      context.t.halalStatusLabel(status),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: color,
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            context.t.halalStatusExplanation(status),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  height: 1.35,
                ),
          ),
          const SizedBox(height: 14),
          _InfoRow(
            title: context.t.halalIngredientScreening,
            value: context.t.halalIngredientScreeningLabel(screeningStatus),
            color: _screeningColor(screeningStatus),
            icon: _screeningIcon(screeningStatus),
          ),
          if (signals.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              context.t.detected,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 8),
            ...signals.take(3).map(
                  (signal) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      '• ${context.t.halalReasonLabel(signal.reasonCode, signal.matchedText)}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ),
          ] else if (reasons.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              context.t.halalReasonLabel(reasons.first, ''),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
          const SizedBox(height: 14),
          _InfoRow(
            title: context.t.halalCertification,
            value: context.t.halalCertificationStatusLabel(certificationStatus),
            color: _certificationColor(certificationStatus),
            icon: _certificationIcon(certificationStatus),
          ),
        ],
      ),
    );
  }

  Color _statusColor(HalalCheckStatus status) {
    return switch (status) {
      HalalCheckStatus.halalConfirmed => const Color(0xFF24C78E),
      HalalCheckStatus.screeningClear => const Color(0xFF7FB2D9),
      HalalCheckStatus.nonHalal => const Color(0xFFF45B69),
      HalalCheckStatus.reviewRequired => const Color(0xFFF59E42),
      HalalCheckStatus.insufficientData => const Color(0xFFA7B4C5),
    };
  }

  IconData _statusIcon(HalalCheckStatus status) {
    return switch (status) {
      HalalCheckStatus.halalConfirmed => Icons.verified_rounded,
      HalalCheckStatus.screeningClear => Icons.shield_outlined,
      HalalCheckStatus.nonHalal => Icons.block_rounded,
      HalalCheckStatus.reviewRequired => Icons.warning_amber_rounded,
      HalalCheckStatus.insufficientData => Icons.help_outline_rounded,
    };
  }

  Color _screeningColor(HalalIngredientScreeningStatus status) {
    return switch (status) {
      HalalIngredientScreeningStatus.clear => const Color(0xFF7FB2D9),
      HalalIngredientScreeningStatus.nonHalalDetected => const Color(0xFFF45B69),
      HalalIngredientScreeningStatus.reviewRequired => const Color(0xFFF59E42),
      HalalIngredientScreeningStatus.insufficientData => const Color(0xFFA7B4C5),
    };
  }

  IconData _screeningIcon(HalalIngredientScreeningStatus status) {
    return switch (status) {
      HalalIngredientScreeningStatus.clear => Icons.check_rounded,
      HalalIngredientScreeningStatus.nonHalalDetected => Icons.block_rounded,
      HalalIngredientScreeningStatus.reviewRequired => Icons.warning_amber_rounded,
      HalalIngredientScreeningStatus.insufficientData => Icons.help_outline_rounded,
    };
  }

  Color _certificationColor(String status) {
    return switch (status) {
      'verified' => const Color(0xFF24C78E),
      'expired' || 'conflict' => const Color(0xFFF59E42),
      _ => const Color(0xFFA7B4C5),
    };
  }

  IconData _certificationIcon(String status) {
    return switch (status) {
      'verified' => Icons.check_rounded,
      'expired' || 'conflict' => Icons.warning_amber_rounded,
      _ => Icons.circle_outlined,
    };
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.title,
    required this.value,
    required this.color,
    required this.icon,
  });

  final String title;
  final String value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.13),
            borderRadius: BorderRadius.circular(10),
          ),
          child: SizedBox(
            width: 24,
            height: 24,
            child: Icon(
              icon,
              size: 15,
              color: color,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
