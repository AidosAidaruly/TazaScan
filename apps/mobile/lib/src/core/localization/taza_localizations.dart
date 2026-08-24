import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _localePreferenceKey = 'tazascan.locale';

enum TazaLocale {
  ru('ru'),
  kk('kk');

  const TazaLocale(this.code);

  final String code;

  static TazaLocale fromCode(String? code) {
    return switch (code) {
      'kk' => TazaLocale.kk,
      _ => TazaLocale.ru,
    };
  }
}

class TazaLocaleController extends ChangeNotifier {
  TazaLocaleController({TazaLocale initialLocale = TazaLocale.ru})
      : _locale = initialLocale;

  TazaLocale _locale;

  TazaLocale get locale => _locale;

  Locale get flutterLocale => Locale(_locale.code);

  static Future<TazaLocaleController> load() async {
    final prefs = await SharedPreferences.getInstance();
    return TazaLocaleController(
      initialLocale: TazaLocale.fromCode(prefs.getString(_localePreferenceKey)),
    );
  }

  Future<void> setLocale(TazaLocale locale) async {
    if (_locale == locale) return;

    _locale = locale;
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_localePreferenceKey, locale.code);
  }
}

class TazaLocalizationScope extends InheritedNotifier<TazaLocaleController> {
  const TazaLocalizationScope({
    required TazaLocaleController controller,
    required super.child,
    super.key,
  }) : super(notifier: controller);

  static final TazaLocaleController _fallbackController =
      TazaLocaleController(initialLocale: TazaLocale.ru);

  static TazaLocaleController controllerOf(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<TazaLocalizationScope>();
    return scope?.notifier ?? _fallbackController;
  }
}

extension TazaLocalizationBuildContext on BuildContext {
  TazaStrings get t => TazaStrings.forLocale(
        TazaLocalizationScope.controllerOf(this).locale,
      );

  TazaLocaleController get tazaLocaleController =>
      TazaLocalizationScope.controllerOf(this);
}

class TazaStrings {
  const TazaStrings._(this.locale);

  final TazaLocale locale;

  static TazaStrings forLocale(TazaLocale locale) => switch (locale) {
        TazaLocale.kk => const TazaStrings._(TazaLocale.kk),
        TazaLocale.ru => const TazaStrings._(TazaLocale.ru),
      };

  bool get isKazakh => locale == TazaLocale.kk;

  String pick({required String ru, required String kk}) => isKazakh ? kk : ru;

  String get appTitle => 'TazaScan';
  String get home => pick(ru: 'Главная', kk: 'Басты');
  String get scan => pick(ru: 'Скан', kk: 'Скан');
  String get favorites => pick(ru: 'Избранное', kk: 'Таңдаулылар');
  String get history => pick(ru: 'История', kk: 'Тарих');
  String get profile => pick(ru: 'Профиль', kk: 'Профиль');
  String get settings => pick(ru: 'Настройки', kk: 'Баптаулар');
  String get language => pick(ru: 'Язык', kk: 'Тіл');
  String get russian => 'Русский';
  String get kazakh => 'Қазақша';
  String get knowWhatsInside =>
      pick(ru: 'Знай, что внутри.', kk: 'Ішінде не барын біл.');

  String get scanProduct =>
      pick(ru: 'Сканировать продукт', kk: 'Өнімді сканерлеу');
  String get pointCameraAtBarcode =>
      pick(ru: 'Наведи камеру на штрихкод', kk: 'Камераны штрихкодқа бағытта');
  String get photoSearch => pick(ru: 'Поиск по фото', kk: 'Фото бойынша іздеу');
  String get findProductFromImage => pick(
        ru: 'Найти продукт по изображению',
        kk: 'Өнімді сурет бойынша табу',
      );
  String get productSearch =>
      pick(ru: 'Поиск продукта', kk: 'Өнімді табу');
  String get searchByNameOrBarcode => pick(
        ru: 'Найти по названию или штрихкоду',
        kk: 'Атауы немесе штрихкоды бойынша табу',
      );
  String get scannedProducts =>
      pick(ru: 'Посмотреть отсканированные продукты', kk: 'Сканерленген өнімдер');
  String get recentScans =>
      pick(ru: 'Недавние сканы', kk: 'Соңғы скандар');
  String get all => pick(ru: 'Все', kk: 'Барлығы');
  String get noScansYet =>
      pick(ru: 'Пока нет сканов', kk: 'Әзірге скандар жоқ');
  String get noRecentScansYet =>
      pick(ru: 'Нет недавних сканов', kk: 'Соңғы скандар жоқ');
  String get scansWillAppearHere => pick(
        ru: 'Когда ты сканируешь продукты, они появятся здесь.',
        kk: 'Өнімдерді сканерлегенде, олар осы жерде пайда болады.',
      );

  String get searchHint => pick(
        ru: 'Название, бренд или штрихкод',
        kk: 'Атауы, бренді немесе штрихкоды',
      );
  String get findProduct =>
      pick(ru: 'Найдите продукт', kk: 'Өнімді табыңыз');
  String get enterNameOrBrand => pick(
        ru: 'Введите название или бренд.',
        kk: 'Атауын немесе брендін енгізіңіз.',
      );
  String get nothingFound =>
      pick(ru: 'Ничего не найдено.', kk: 'Ештеңе табылмады.');
  String get productNotFound =>
      pick(ru: 'Продукт не найден', kk: 'Өнім табылмады');
  String get helpAddProduct => pick(
        ru: 'Не нашли продукт? Помогите добавить его.',
        kk: 'Өнім табылмады ма? Оны қосуға көмектесіңіз.',
      );
  String get addProduct => pick(ru: 'Добавить продукт', kk: 'Өнім қосу');
  String get retry => pick(ru: 'Повторить', kk: 'Қайталау');
  String get clear => pick(ru: 'Очистить', kk: 'Тазалау');

  String get searchFailed => pick(
        ru: 'Не удалось выполнить поиск',
        kk: 'Іздеуді орындау мүмкін болмады',
      );
  String get checkConnectionAndRetry => pick(
        ru: 'Проверьте подключение и попробуйте снова.',
        kk: 'Интернет байланысын тексеріп, қайта көріңіз.',
      );
  String get serverSlow =>
      pick(ru: 'Сервер долго отвечает', kk: 'Сервер ұзақ жауап беруде');
  String get serverUnavailable =>
      pick(ru: 'Сервер недоступен', kk: 'Сервер қолжетімсіз');
  String get tryAgain => pick(ru: 'Попробуйте снова.', kk: 'Қайта көріңіз.');

  String get choosePhoto =>
      pick(ru: 'Выбрать фото', kk: 'Фото таңдау');
  String get takePhoto => pick(ru: 'Сделать фото', kk: 'Фото түсіру');
  String get chooseAnotherPhoto =>
      pick(ru: 'Выбрать другое фото', kk: 'Басқа фото таңдау');
  String get photoGuidance => pick(
        ru: 'Лучше всего работает, если название продукта хорошо видно на фото.',
        kk: 'Өнім атауы фотода анық көрінсе, іздеу жақсырақ жұмыс істейді.',
      );
  String get photoNoMatchTitle => pick(
        ru: 'Продукт по фото не найден',
        kk: 'Фото бойынша өнім табылмады',
      );
  String get photoNoMatchMessage => pick(
        ru: 'Попробуйте отсканировать штрихкод или найти продукт по названию.',
        kk: 'Штрихкодты сканерлеп көріңіз немесе өнімді атауы бойынша іздеңіз.',
      );
  String get scanBarcode =>
      pick(ru: 'Сканировать штрихкод', kk: 'Штрихкодты сканерлеу');
  String get findByName =>
      pick(ru: 'Найти по названию', kk: 'Атауы бойынша табу');
  String get photoTooLarge =>
      pick(ru: 'Фото слишком большое', kk: 'Фото тым үлкен');
  String get cannotOpenImage =>
      pick(ru: 'Не удалось открыть изображение', kk: 'Суретті ашу мүмкін болмады');
  String get cannotUploadPhoto =>
      pick(ru: 'Не удалось отправить фото', kk: 'Фотоны жіберу мүмкін болмады');

  String get productDetails =>
      pick(ru: 'Детали продукта', kk: 'Өнім туралы');
  String get productDataUnavailable => pick(
        ru: 'Не удалось загрузить данные продукта.',
        kk: 'Өнім деректерін жүктеу мүмкін болмады.',
      );
  String get scoreUnavailable =>
      pick(ru: 'TazaScore пока недоступен', kk: 'TazaScore әзірге қолжетімсіз');
  String get insufficientData =>
      pick(ru: 'Недостаточно данных', kk: 'Деректер жеткіліксіз');
  String get noAdditionalNotes => pick(
        ru: 'Дополнительных замечаний нет.',
        kk: 'Қосымша ескертулер жоқ.',
      );
  String get whyThisScore =>
      pick(ru: 'Почему такая оценка', kk: 'Неліктен мұндай баға?');
  String get scoreReliability =>
      pick(ru: 'Достоверность оценки', kk: 'Бағалаудың сенімділігі');
  String get dataReliability =>
      pick(ru: 'Достоверность данных', kk: 'Деректер сенімділігі');
  String get keyDataAvailable =>
      pick(ru: 'Доступно ключевых данных', kk: 'Қолжетімді негізгі деректер');
  String get additives =>
      pick(ru: 'Добавки', kk: 'Қоспалар');
  String get informationalAnalysis => pick(
        ru: 'Информационный анализ',
        kk: 'Ақпараттық талдау',
      );
  String get processingDegree =>
      pick(ru: 'Степень обработки', kk: 'Өңдеу деңгейі');
  String get processingNotScored =>
      pick(ru: 'Пока не учитывается', kk: 'Әзірге ескерілмейді');
  String get nutritionProfile =>
      pick(ru: 'Питательный профиль', kk: 'Тағамдық профиль');
  String get ingredientsAndAdditives =>
      pick(ru: 'Состав и добавки', kk: 'Құрамы мен қоспалар');
  String get missingImportantData =>
      pick(ru: 'Не хватает важных данных', kk: 'Маңызды деректер жоқ');
  String get missingData =>
      pick(ru: 'Не хватает данных', kk: 'Деректер жоқ');
  String get partialDataNotice => pick(
        ru: 'Некоторые данные о продукте отсутствуют. Оценка рассчитана по доступной информации.',
        kk: 'Өнім туралы кейбір деректер жоқ. Баға қолжетімді ақпарат бойынша есептелді.',
      );
  String get scoreLimitedByMissingData => pick(
        ru: 'Оценка ограничена из-за неполных данных.',
        kk: 'Деректер толық болмағандықтан баға шектелді.',
      );
  String get scoreLimitApplied => pick(
        ru: 'Для защиты от завышенной оценки применено ограничение.',
        kk: 'Бағаның негізсіз жоғары болмауы үшін шектеу қолданылды.',
      );
  String get lowConfidenceNotice => pick(
        ru: 'Данных недостаточно для высокой точности оценки.',
        kk: 'Бағаның жоғары дәлдігі үшін деректер жеткіліксіз.',
      );
  String get detailsAboutScore =>
      pick(ru: 'Подробнее об оценке', kk: 'Баға туралы толығырақ');
  String get unavailableBecausePartial => pick(
        ru: 'Недоступен из-за неполных данных',
        kk: 'Деректер толық болмағандықтан қолжетімсіз',
      );
  String get tazaScoreDisclosure => pick(
        ru: 'TazaScore — информационная оценка пищевого профиля продукта на основе Nutri-Score V2-2023 и доступных данных о составе. Не является медицинской рекомендацией.',
        kk: 'TazaScore — Nutri-Score V2-2023 және қолжетімді құрам деректері негізіндегі өнімнің тағамдық профилін ақпараттық бағалау. Медициналық ұсыныс емес.',
      );

  String get nutritionTitle =>
      pick(ru: 'Пищевая ценность', kk: 'Тағамдық құндылығы');
  String get energy => pick(ru: 'Энергетическая ценность', kk: 'Энергетикалық құндылығы');
  String get protein => pick(ru: 'Белки', kk: 'Ақуыз');
  String get fat => pick(ru: 'Жиры', kk: 'Май');
  String get saturatedFat =>
      pick(ru: 'Насыщенные жиры', kk: 'Қаныққан майлар');
  String get carbohydrates => pick(ru: 'Углеводы', kk: 'Көмірсулар');
  String get sugars => pick(ru: 'Сахара', kk: 'Қант');
  String get fiber => pick(ru: 'Пищевые волокна', kk: 'Тағамдық талшықтар');
  String get salt => pick(ru: 'Соль', kk: 'Тұз');
  String get noData => pick(ru: 'Нет данных', kk: 'Деректер жоқ');
  String get lowContent =>
      pick(ru: 'Низкое содержание', kk: 'Төмен мөлшер');
  String get moderateContent =>
      pick(ru: 'Умеренное содержание', kk: 'Орташа мөлшер');
  String get highContent =>
      pick(ru: 'Высокое содержание', kk: 'Жоғары мөлшер');

  String get ingredients => pick(ru: 'Состав', kk: 'Құрамы');
  String get ingredientsNotProvided =>
      pick(ru: 'Состав не указан', kk: 'Құрамы көрсетілмеген');
  String get translatedAutomatically =>
      pick(ru: 'Переведено автоматически', kk: 'Автоматты түрде аударылды');
  String get compositionSummary =>
      pick(ru: 'Кратко о составе', kk: 'Құрамы туралы қысқаша');
  String get whatIsInside =>
      pick(ru: 'Что в составе', kk: 'Құрамында не бар');
  String get foodAdditives =>
      pick(ru: 'Пищевые добавки', kk: 'Тағамдық қоспалар');
  String get allergens => pick(ru: 'Аллергены', kk: 'Аллергендер');
  String get showAll => pick(ru: 'Показать все', kk: 'Барлығын көрсету');
  String get hide => pick(ru: 'Скрыть', kk: 'Жасыру');
  String get showFully =>
      pick(ru: 'Показать полностью', kk: 'Толық көрсету');

  String get favoritesEmpty =>
      pick(ru: 'В избранном пока ничего нет', kk: 'Таңдаулылар әзірге бос');
  String get historyEmpty =>
      pick(ru: 'История пока пуста', kk: 'Тарих әзірге бос');
  String get clearHistory =>
      pick(ru: 'Очистить историю', kk: 'Тарихты тазалау');
  String get clearHistoryQuestion =>
      pick(ru: 'Очистить историю?', kk: 'Тарихты тазалау керек пе?');
  String get clearHistoryMessage => pick(
        ru: 'Это удалит всю локальную историю сканирования.',
        kk: 'Бұл құрылғыдағы барлық сканерлеу тарихын өшіреді.',
      );
  String get cancel => pick(ru: 'Отмена', kk: 'Бас тарту');

  String get addProductTitle =>
      pick(ru: 'Добавить продукт', kk: 'Өнім қосу');
  String get submittedTitle =>
      pick(ru: 'Заявка отправлена', kk: 'Өтінім жіберілді');
  String get submittedMessage => pick(
        ru: 'Спасибо. Продукт отправлен на модерацию.',
        kk: 'Рақмет. Өнім модерацияға жіберілді.',
      );
  String get submitForReviewQuestion =>
      pick(ru: 'Отправить на проверку?', kk: 'Тексеруге жіберу керек пе?');
  String get edit => pick(ru: 'Изменить', kk: 'Өзгерту');
  String get submit => pick(ru: 'Отправить', kk: 'Жіберу');
  String get submitting => pick(ru: 'Отправляем...', kk: 'Жіберілуде...');
  String get checkAndSubmit =>
      pick(ru: 'Проверить и отправить', kk: 'Тексеріп жіберу');
  String get recognizingData =>
      pick(ru: 'Распознаём данные...', kk: 'Деректер анықталуда...');
  String get portionType => pick(ru: 'Тип порции', kk: 'Порция түрі');
  String get per100g => pick(ru: 'на 100 г', kk: '100 г үшін');
  String get per100ml => pick(ru: 'на 100 мл', kk: '100 мл үшін');
  String get packagePhoto =>
      pick(ru: 'Фото упаковки', kk: 'Қаптаманың фотосы');
  String get nutritionPhoto =>
      pick(ru: 'Фото пищевой ценности', kk: 'Тағамдық құндылықтың фотосы');
  String get ingredientsPhoto =>
      pick(ru: 'Фото состава', kk: 'Құрамының фотосы');
  String get barcodePhoto =>
      pick(ru: 'Фото штрихкода', kk: 'Штрихкод фотосы');

  String get halalCheck => pick(ru: 'Halal Check', kk: 'Halal Check');
  String get detected => pick(ru: 'Обнаружено:', kk: 'Анықталды:');
  String get halalCertificationCheckedSeparately => pick(
        ru: 'Сертификация проверяется отдельно.',
        kk: 'Сертификат бөлек тексеріледі.',
      );

  String halalStatusLabel(Object status) {
    return switch (status.toString()) {
      'HalalCheckStatus.halalConfirmed' ||
      'halal_confirmed' =>
        pick(ru: 'Халяль подтверждён', kk: 'Халал расталған'),
      'HalalCheckStatus.screeningClear' ||
      'screening_clear' =>
        pick(ru: 'По составу явных проблем не обнаружено', kk: 'Құрамынан айқын мәселе анықталмады'),
      'HalalCheckStatus.nonHalal' ||
      'non_halal' =>
        pick(ru: 'Обнаружен нехаляльный ингредиент', kk: 'Халал емес ингредиент анықталды'),
      'HalalCheckStatus.reviewRequired' ||
      'review_required' =>
        pick(ru: 'Требует проверки', kk: 'Тексеруді қажет етеді'),
      _ => pick(ru: 'Недостаточно данных', kk: 'Деректер жеткіліксіз'),
    };
  }

  String halalStatusExplanation(Object status) {
    return switch (status.toString()) {
      'HalalCheckStatus.halalConfirmed' ||
      'halal_confirmed' =>
        pick(
          ru: 'Подтверждение основано на проверенной сертификации. Halal Check не является религиозным заключением.',
          kk: 'Растау тексерілген сертификатқа негізделген. Halal Check діни қорытынды емес.',
        ),
      'HalalCheckStatus.screeningClear' ||
      'screening_clear' =>
        halalCertificationCheckedSeparately,
      'HalalCheckStatus.nonHalal' ||
      'non_halal' =>
        pick(
          ru: 'В составе обнаружен ингредиент, несовместимый с Halal Check v1.2.',
          kk: 'Құрамда Halal Check v1.2 әдістемесіне сәйкес келмейтін ингредиент анықталды.',
        ),
      'HalalCheckStatus.reviewRequired' ||
      'review_required' =>
        pick(
          ru: 'Некоторые ингредиенты требуют проверки происхождения. Отсутствие риска не означает подтверждение халяль.',
          kk: 'Кейбір ингредиенттердің шығу тегін тексеру қажет. Қауіп табылмауы халал расталды дегенді білдірмейді.',
        ),
      _ => pick(
          ru: 'Недостаточно данных о составе для проверки.',
          kk: 'Тексеру үшін өнім құрамы туралы деректер жеткіліксіз.',
        ),
    };
  }

  String halalReasonLabel(String code, String matchedText) {
    final detected = matchedText.trim();
    final suffix = detected.isEmpty ? '' : ' $detected';

    return switch (code) {
      'PORK_DETECTED' => pick(ru: 'Обнаружена свинина$suffix', kk: 'Шошқа еті анықталды$suffix'),
      'PORK_FAT_DETECTED' => pick(ru: 'Обнаружен свиной жир$suffix', kk: 'Шошқа майы анықталды$suffix'),
      'PORCINE_GELATIN_DETECTED' => pick(ru: 'Обнаружен свиной желатин$suffix', kk: 'Шошқа желатині анықталды$suffix'),
      'GELATIN_SOURCE_UNKNOWN' => pick(ru: 'Желатин - источник не указан', kk: 'Желатин - шығу тегі көрсетілмеген'),
      'CARMINE_E120_DETECTED' => pick(ru: 'Кармин (E120) требует проверки', kk: 'Кармин (E120) тексеруді қажет етеді'),
      'ALCOHOL_DETECTED' => pick(ru: 'Обнаружен спирт/этанол$suffix', kk: 'Спирт/этанол анықталды$suffix'),
      'ALCOHOL_BASED_FLAVOURING_DETECTED' => pick(ru: 'Ароматизатор на спиртовой основе требует проверки', kk: 'Спирт негізіндегі хош иістендіргіш тексеруді қажет етеді'),
      'ANIMAL_RENNET_SOURCE_UNKNOWN' => pick(ru: 'Сычужный фермент - источник не указан', kk: 'Ұйытқы ферменті - шығу тегі көрсетілмеген'),
      'ANIMAL_ENZYMES_SOURCE_UNKNOWN' => pick(ru: 'Ферменты животного происхождения требуют проверки', kk: 'Жануар текті ферменттер тексеруді қажет етеді'),
      'E471_SOURCE_UNKNOWN' => pick(ru: 'E471 - происхождение не указано', kk: 'E471 - шығу тегі көрсетілмеген'),
      'E472_SOURCE_UNKNOWN' => pick(ru: 'E472 - происхождение не указано', kk: 'E472 - шығу тегі көрсетілмеген'),
      'ANIMAL_FAT_SOURCE_UNKNOWN' => pick(ru: 'Животный жир - вид животного не указан', kk: 'Жануар майы - жануар түрі көрсетілмеген'),
      'BLOOD_DETECTED' => pick(ru: 'Обнаружен ингредиент на основе крови$suffix', kk: 'Қан негізіндегі ингредиент анықталды$suffix'),
      'INGREDIENTS_MISSING' => pick(ru: 'Недостаточно данных о составе для проверки.', kk: 'Тексеру үшін өнім құрамы туралы деректер жеткіліксіз.'),
      'CERTIFICATION_VERIFIED' => pick(ru: 'Есть проверенная halal-сертификация', kk: 'Тексерілген halal сертификаты бар'),
      'CERTIFICATION_UNVERIFIED' => pick(ru: 'Сертификация не подтверждена', kk: 'Сертификат расталмаған'),
      'CERTIFICATION_EXPIRED' => pick(ru: 'Срок сертификации истёк', kk: 'Сертификат мерзімі өткен'),
      'CERTIFICATION_CONFLICT' => pick(ru: 'Есть конфликт между сертификацией и составом', kk: 'Сертификат пен құрам арасында қайшылық бар'),
      _ => pick(ru: 'Дополнительных замечаний нет.', kk: 'Қосымша ескертулер жоқ.'),
    };
  }

  String get halalIngredientScreening =>
      pick(ru: 'Проверка состава', kk: 'Құрамды тексеру');
  String get halalCertification =>
      pick(ru: 'Сертификация', kk: 'Сертификаттау');

  String halalBadgeLabel(Object status) {
    return switch (status.toString()) {
      'HalalCheckStatus.halalConfirmed' ||
      'halal_confirmed' =>
        pick(ru: 'Подтверждён', kk: 'Расталған'),
      'HalalCheckStatus.screeningClear' ||
      'screening_clear' =>
        pick(ru: 'Без явных проблем', kk: 'Айқын мәселе жоқ'),
      'HalalCheckStatus.nonHalal' ||
      'non_halal' =>
        pick(ru: 'Не халяль', kk: 'Халал емес'),
      'HalalCheckStatus.reviewRequired' ||
      'review_required' =>
        pick(ru: 'Требует проверки', kk: 'Тексеру қажет'),
      _ => pick(ru: 'Недостаточно данных', kk: 'Деректер жеткіліксіз'),
    };
  }

  String halalIngredientScreeningLabel(Object status) {
    return switch (status.toString()) {
      'HalalIngredientScreeningStatus.clear' ||
      'clear' =>
        pick(ru: 'По доступному составу запрещённые ингредиенты не обнаружены.', kk: 'Қолжетімді құрам бойынша тыйым салынған ингредиенттер анықталмады.'),
      'HalalIngredientScreeningStatus.nonHalalDetected' ||
      'non_halal_detected' =>
        pick(ru: 'Обнаружен запрещённый ингредиент', kk: 'Тыйым салынған ингредиент анықталды'),
      'HalalIngredientScreeningStatus.reviewRequired' ||
      'review_required' =>
        pick(ru: 'Требуется проверка происхождения', kk: 'Шығу тегін тексеру қажет'),
      _ => pick(ru: 'Недостаточно данных о составе', kk: 'Құрам туралы деректер жеткіліксіз'),
    };
  }

  String halalCertificationLabel(String status) {
    return switch (status) {
      'not_verified' => pick(ru: 'Сертификация: не подтверждена', kk: 'Сертификат: расталмаған'),
      'verified' => pick(ru: 'Сертификация: подтверждена', kk: 'Сертификат: расталған'),
      'unverified' => pick(ru: 'Сертификация: не подтверждена', kk: 'Сертификат: расталмаған'),
      'expired' => pick(ru: 'Сертификация: срок истёк', kk: 'Сертификат: мерзімі өткен'),
      'conflict' => pick(ru: 'Сертификация: требуется проверка', kk: 'Сертификат: тексеруді қажет етеді'),
      _ => pick(ru: 'Сертификация: не подтверждена', kk: 'Сертификат: расталмаған'),
    };
  }

  String halalCertificationStatusLabel(String status) {
    return switch (status) {
      'verified' => pick(ru: 'Подтверждена', kk: 'Расталған'),
      'expired' => pick(ru: 'Срок сертификата истёк', kk: 'Сертификат мерзімі өткен'),
      'conflict' => pick(ru: 'Обнаружено противоречие', kk: 'Қайшылық анықталды'),
      _ => pick(ru: 'Не подтверждена', kk: 'Расталмаған'),
    };
  }

  String confidenceLabel(String value) {
    return switch (value.trim().toLowerCase()) {
      'high' => pick(ru: 'Высокая', kk: 'Жоғары'),
      'medium' => pick(ru: 'Средняя', kk: 'Орташа'),
      'low' => pick(ru: 'Низкая', kk: 'Төмен'),
      _ => pick(ru: 'Нет данных', kk: 'Деректер жоқ'),
    };
  }

  String scoreCategory(int? score) {
    if (score == null) return insufficientData;
    if (score >= 80) return pick(ru: 'Отличный', kk: 'Өте жақсы');
    if (score >= 60) return pick(ru: 'Хороший', kk: 'Жақсы');
    if (score >= 40) return pick(ru: 'Средний', kk: 'Орташа');
    if (score >= 20) return pick(ru: 'Низкий', kk: 'Төмен');
    return pick(ru: 'Очень низкий', kk: 'Өте төмен');
  }
}
