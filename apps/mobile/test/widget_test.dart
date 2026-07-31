import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/app.dart';

void main() {
  testWidgets('shows home screen actions', (tester) async {
    await tester.pumpWidget(const ProjectApp());

    expect(find.text('Project'), findsOneWidget);
    expect(find.text('Scan Product'), findsOneWidget);
    expect(find.text('Search Product'), findsOneWidget);
    expect(find.text('No recent scans yet'), findsOneWidget);
  });
}
