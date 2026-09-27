import 'package:flutter/material.dart';

/// Elevation/shadow rules (spec §32): four levels only.
abstract final class LwElevation {
  static const List<BoxShadow> none = <BoxShadow>[];

  static const List<BoxShadow> low = <BoxShadow>[
    BoxShadow(
      color: Color(0x14000000),
      blurRadius: 2,
      offset: Offset(0, 1),
    ),
  ];

  static const List<BoxShadow> medium = <BoxShadow>[
    BoxShadow(
      color: Color(0x1F000000),
      blurRadius: 8,
      offset: Offset(0, 2),
    ),
  ];

  static const List<BoxShadow> high = <BoxShadow>[
    BoxShadow(
      color: Color(0x33000000),
      blurRadius: 16,
      offset: Offset(0, 6),
    ),
  ];
}
