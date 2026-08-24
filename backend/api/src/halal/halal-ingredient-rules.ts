import type { HalalIngredientRule } from './types';

export const halalIngredientRules: HalalIngredientRule[] = [
  {
    id: 'explicit_pork',
    severity: 'non_halal',
    reasonCode: 'PORK_DETECTED',
    category: 'pork_porcine',
    sourceDependency: 'explicit_prohibited',
    consumerReasonKey: 'porkDetected',
    explanationKey: 'explicitPork',
    aliases: [
      'pork',
      'porcine',
      'pig meat',
      'pork extract',
      'свинина',
      'свиное мясо',
      'свиной экстракт',
      'шошқа еті'
    ]
  },
  {
    id: 'pork_fat',
    severity: 'non_halal',
    reasonCode: 'PORK_FAT_DETECTED',
    category: 'pork_porcine',
    sourceDependency: 'explicit_prohibited',
    consumerReasonKey: 'porkFatDetected',
    explanationKey: 'explicitPorkFat',
    aliases: [
      'lard',
      'pork fat',
      'pig fat',
      'свиной жир',
      'свиное сало',
      'шошқа майы'
    ]
  },
  {
    id: 'porcine_gelatin',
    severity: 'non_halal',
    reasonCode: 'PORCINE_GELATIN_DETECTED',
    category: 'gelatin',
    sourceDependency: 'explicit_prohibited',
    consumerReasonKey: 'porcineGelatinDetected',
    explanationKey: 'porcineGelatin',
    aliases: [
      'porcine gelatin',
      'pork gelatin',
      'pig gelatin',
      'свиной желатин',
      'желатин свиного происхождения',
      'шошқа желатині'
    ]
  },
  {
    id: 'generic_gelatin',
    severity: 'review_required',
    reasonCode: 'GELATIN_SOURCE_UNKNOWN',
    category: 'gelatin',
    sourceDependency: 'source_dependent',
    consumerReasonKey: 'gelatinSourceUnknown',
    explanationKey: 'gelatinSourceUnknown',
    aliases: ['gelatin', 'gelatine', 'bovine gelatin', 'говяжий желатин', 'желатин'],
    excludedAliases: [
      'porcine gelatin',
      'pork gelatin',
      'pig gelatin',
      'fish gelatin',
      'halal gelatin',
      'свиной желатин',
      'рыбный желатин',
      'халяльный желатин'
    ]
  },
  {
    id: 'carmine_e120',
    severity: 'review_required',
    reasonCode: 'CARMINE_E120_DETECTED',
    category: 'carmine_e120',
    sourceDependency: 'source_dependent',
    consumerReasonKey: 'carmineE120Detected',
    explanationKey: 'carmineE120',
    aliases: ['e120', 'e 120', 'e-120', 'carmine', 'cochineal', 'кармин', 'кошениль']
  },
  {
    id: 'explicit_alcohol',
    severity: 'non_halal',
    reasonCode: 'ALCOHOL_DETECTED',
    category: 'alcohol_ethanol',
    sourceDependency: 'explicit_prohibited',
    consumerReasonKey: 'alcoholDetected',
    explanationKey: 'explicitAlcohol',
    aliases: ['alcohol', 'ethanol', 'ethyl alcohol', 'спирт', 'этанол', 'этиловый спирт'],
    excludedAliases: [
      'sugar alcohol',
      'sugar alcohols',
      'fatty alcohol',
      'fatty alcohols',
      'benzyl alcohol',
      'cetyl alcohol',
      'stearyl alcohol'
    ]
  },
  {
    id: 'alcohol_based_flavouring',
    severity: 'review_required',
    reasonCode: 'ALCOHOL_BASED_FLAVOURING_DETECTED',
    category: 'alcohol_ethanol',
    sourceDependency: 'source_dependent',
    consumerReasonKey: 'alcoholBasedFlavouringDetected',
    explanationKey: 'alcoholBasedFlavouring',
    aliases: [
      'alcohol based flavouring',
      'alcohol-based flavouring',
      'alcohol based flavoring',
      'alcohol-based flavoring',
      'ароматизатор на спиртовой основе'
    ]
  },
  {
    id: 'animal_rennet_unknown',
    severity: 'review_required',
    reasonCode: 'ANIMAL_RENNET_SOURCE_UNKNOWN',
    category: 'rennet_enzymes',
    sourceDependency: 'source_dependent',
    consumerReasonKey: 'animalRennetSourceUnknown',
    explanationKey: 'animalRennetSourceUnknown',
    aliases: ['animal rennet', 'rennet', 'сычужный фермент'],
    excludedAliases: [
      'microbial rennet',
      'vegetarian rennet',
      'microbial enzyme',
      'vegetarian enzyme',
      'микробиальный фермент'
    ]
  },
  {
    id: 'animal_enzymes_unknown',
    severity: 'review_required',
    reasonCode: 'ANIMAL_ENZYMES_SOURCE_UNKNOWN',
    category: 'rennet_enzymes',
    sourceDependency: 'source_dependent',
    consumerReasonKey: 'animalEnzymesSourceUnknown',
    explanationKey: 'animalEnzymesSourceUnknown',
    aliases: [
      'animal enzymes',
      'enzymes of animal origin',
      'ферменты животного происхождения'
    ]
  },
  {
    id: 'e471_unknown',
    severity: 'review_required',
    reasonCode: 'E471_SOURCE_UNKNOWN',
    category: 'mono_diglycerides',
    sourceDependency: 'source_dependent',
    consumerReasonKey: 'e471SourceUnknown',
    explanationKey: 'e471SourceUnknown',
    aliases: [
      'e471',
      'e 471',
      'e-471',
      'mono- and diglycerides',
      'mono and diglycerides',
      'моно- и диглицериды'
    ],
    excludedAliases: [
      'plant mono- and diglycerides',
      'vegetable mono- and diglycerides',
      'e471 from vegetable source',
      'e471 vegetable source',
      'e471 vegetable origin',
      'моно- и диглицериды растительного происхождения',
      'растительные моно- и диглицериды'
    ]
  },
  {
    id: 'e472_unknown',
    severity: 'review_required',
    reasonCode: 'E472_SOURCE_UNKNOWN',
    category: 'mono_diglycerides',
    sourceDependency: 'source_dependent',
    consumerReasonKey: 'e472SourceUnknown',
    explanationKey: 'e472SourceUnknown',
    aliases: [
      'e472',
      'e 472',
      'e-472',
      'e472a',
      'e472b',
      'e472c',
      'e472d',
      'e472e',
      'e472f',
      'e 472a',
      'e 472b',
      'e 472c',
      'e 472d',
      'e 472e',
      'e 472f',
      'e-472a',
      'e-472b',
      'e-472c',
      'e-472d',
      'e-472e',
      'e-472f'
    ],
    excludedAliases: [
      'plant e472',
      'vegetable e472',
      'e472 from vegetable source',
      'e472 vegetable source',
      'растительный e472'
    ]
  },
  {
    id: 'animal_fat_unknown',
    severity: 'review_required',
    reasonCode: 'ANIMAL_FAT_SOURCE_UNKNOWN',
    category: 'animal_fat',
    sourceDependency: 'source_dependent',
    consumerReasonKey: 'animalFatSourceUnknown',
    explanationKey: 'animalFatSourceUnknown',
    aliases: ['animal fat', 'animal shortening', 'животный жир'],
    excludedAliases: ['plant fat', 'vegetable fat', 'vegetable oil', 'растительный жир']
  },
  {
    id: 'blood_derived',
    severity: 'non_halal',
    reasonCode: 'BLOOD_DETECTED',
    category: 'blood',
    sourceDependency: 'explicit_prohibited',
    consumerReasonKey: 'bloodDetected',
    explanationKey: 'bloodDerived',
    aliases: ['blood', 'blood plasma', 'кровь', 'кровяная плазма']
  }
];
