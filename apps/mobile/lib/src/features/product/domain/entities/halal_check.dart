enum HalalCheckStatus {
  halalConfirmed,
  screeningClear,
  nonHalal,
  reviewRequired,
  insufficientData,
}

enum HalalIngredientScreeningStatus {
  clear,
  reviewRequired,
  nonHalalDetected,
  insufficientData,
}

class HalalCheck {
  const HalalCheck({
    required this.status,
    required this.ingredientScreeningStatus,
    required this.reasons,
    required this.matchedSignals,
    required this.certificationStatus,
    required this.methodology,
  });

  final HalalCheckStatus status;
  final HalalIngredientScreeningStatus ingredientScreeningStatus;
  final List<String> reasons;
  final List<HalalMatchedSignal> matchedSignals;
  final String certificationStatus;
  final String methodology;
}

class HalalMatchedSignal {
  const HalalMatchedSignal({
    required this.reasonCode,
    required this.severity,
    required this.matchedText,
  });

  final String reasonCode;
  final String severity;
  final String matchedText;
}
