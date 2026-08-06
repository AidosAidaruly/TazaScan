class PaginatedResponse<T> {
  const PaginatedResponse({required this.data, required this.pagination});

  final List<T> data;
  final PaginationMeta pagination;

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> item) parseItem,
  ) {
    final rawData = json['data'];
    if (rawData is! List) {
      throw const FormatException('Expected paginated response data list.');
    }

    final rawPagination = json['pagination'];
    if (rawPagination is! Map) {
      throw const FormatException(
        'Expected paginated response pagination object.',
      );
    }

    return PaginatedResponse<T>(
      data: rawData.map((item) {
        if (item is! Map) {
          throw const FormatException('Expected product item object.');
        }

        return parseItem(Map<String, dynamic>.from(item));
      }).toList(),
      pagination: PaginationMeta.fromJson(
        Map<String, dynamic>.from(rawPagination),
      ),
    );
  }
}

class PaginationMeta {
  const PaginationMeta({
    required this.page,
    required this.pageSize,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int pageSize;
  final int total;
  final int totalPages;

  factory PaginationMeta.fromJson(Map<String, dynamic> json) {
    return PaginationMeta(
      page: _readInt(json['page'], 'page'),
      pageSize: _readInt(json['pageSize'], 'pageSize'),
      total: _readInt(json['total'], 'total'),
      totalPages: _readInt(json['totalPages'], 'totalPages'),
    );
  }

  static int _readInt(Object? value, String field) {
    if (value is int) {
      return value;
    }

    if (value is num) {
      return value.toInt();
    }

    throw FormatException('Expected pagination.$field number.');
  }
}
