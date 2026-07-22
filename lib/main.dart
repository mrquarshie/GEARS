import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'firebase_options.dart';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const _ink    = Color(0xFF17211C);
const _forest = Color(0xFF155E42);
const _lime   = Color(0xFFD5F26A);
const _cream  = Color(0xFFFFFCF5);
const _muted  = Color(0xFF68736B);

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (_) {}
  runApp(const GearsApp());
}

// ---------------------------------------------------------------------------
// Root app widget
// ---------------------------------------------------------------------------
final themeNotifier = ValueNotifier<ThemeMode>(ThemeMode.light);

class GearsApp extends StatelessWidget {
  const GearsApp({super.key});

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<ThemeMode>(
    valueListenable: themeNotifier,
    builder: (_, mode, __) => MaterialApp(
      title: 'Gears Ghana',
      debugShowCheckedModeBanner: false,
      themeMode: mode,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: _cream,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _forest,
          brightness: Brightness.light,
        ),
        textTheme: GoogleFonts.interTextTheme(),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: _forest,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            padding: const EdgeInsets.symmetric(vertical: 16),
            textStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15),
          ),
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFF0F1411),
        colorScheme: ColorScheme.fromSeed(
          seedColor: _forest,
          brightness: Brightness.dark,
          surface: const Color(0xFF17211C),
        ),
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: _forest,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            padding: const EdgeInsets.symmetric(vertical: 16),
            textStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15),
          ),
        ),
      ),
      home: const FinderPage(),
    ),
  );
}

// ---------------------------------------------------------------------------
// Mechanic data model — includes optional Firestore document ID
// ---------------------------------------------------------------------------
class Mechanic {
  const Mechanic({
    this.id,
    this.createdBy,
    required this.name,
    required this.area,
    required this.specialty,
    required this.distance,
    required this.rating,
    required this.phone,
    this.ratingCount = 0,
    this.ratingSum   = 0,
    this.open = true,
    this.lat,
    this.lng,
    this.timeInMinutes,
  });

  final String?  id, createdBy;
  final String   name, area, specialty, distance, rating, phone;
  final int      ratingCount;
  final double   ratingSum;
  final bool     open;
  final double?  lat, lng;
  final int?     timeInMinutes;

  factory Mechanic.fromDoc(DocumentSnapshot doc) {
    final map = doc.data() as Map<String, dynamic>? ?? {};
    return Mechanic(
      id:          doc.id,
      createdBy:   map['createdBy'],
      name:        map['name']      ?? 'Local mechanic',
      area:        map['area']      ?? 'Accra',
      specialty:   map['specialty'] ?? 'General repairs',
      distance:    map['distance']  ?? 'Nearby',
      rating:      '${map['rating'] ?? 'New'}',
      phone:       map['phone']     ?? '',
      ratingCount: (map['ratingCount'] as int?)    ?? 0,
      ratingSum:   ((map['ratingSum'] as num?)     ?? 0).toDouble(),
      open:        map['open']      ?? true,
      lat:         (map['lat'] as num?)?.toDouble(),
      lng:         (map['lng'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toMap() => {
    'name':      name,
    'area':      area,
    'specialty': specialty,
    'distance':  distance,
    'rating':    rating,
    'ratingCount': ratingCount,
    'ratingSum':   ratingSum,
    'phone':     phone,
    'open':      open,
    'createdAt': FieldValue.serverTimestamp(),
  };

  Mechanic copyWith({String? rating, String? name, String? area, String? phone, String? specialty}) => Mechanic(
    id:          id,
    createdBy:   createdBy,
    name:        name ?? this.name,
    area:        area ?? this.area,
    specialty:   specialty ?? this.specialty,
    distance:    distance,
    rating:      rating ?? this.rating,
    phone:       phone ?? this.phone,
    ratingCount: ratingCount,
    ratingSum:   ratingSum,
    open:        open,
    lat:         lat,
    lng:         lng,
    timeInMinutes: timeInMinutes,
  );
}

// ---------------------------------------------------------------------------
// FinderPage — main screen
// ---------------------------------------------------------------------------
class FinderPage extends StatefulWidget {
  const FinderPage({super.key});
  @override
  State<FinderPage> createState() => _FinderPageState();
}

class _FinderPageState extends State<FinderPage> {
  final _searchCtrl = TextEditingController();
  List<Mechanic> _allMechanics = [];
  bool _locating = false;
  bool _loading  = true;
  String _place  = 'Ghana';
  String _searchQuery = '';
  Position? _userPosition;

  List<Mechanic> get _filtered => _searchQuery.isEmpty
      ? _allMechanics
      : _allMechanics.where((m) {
          final q = _searchQuery.toLowerCase();
          return m.name.toLowerCase().contains(q) ||
              m.area.toLowerCase().contains(q) ||
              m.specialty.toLowerCase().contains(q);
        }).toList();

  @override
  void initState() {
    super.initState();
    _loadMechanics();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMechanics() async {
    try {
      final snap = await FirebaseFirestore.instance
          .collection('mechanics')
          .limit(100)
          .get();
      if (mounted) {
        setState(() => _allMechanics = snap.docs.map(Mechanic.fromDoc).toList());
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _useMyLocation() async {
    setState(() => _locating = true);
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        throw Exception('denied');
      }
      final pos = await Geolocator.getCurrentPosition();
      if (mounted) {
        setState(() {
          _userPosition = pos;
          _place = 'Your current location';
          _searchQuery = '';
          _searchCtrl.text = _place;
          
          // Recalculate distances for all mechanics
          _allMechanics = _allMechanics.map((m) {
            if (m.lat != null && m.lng != null) {
              final distInMeters = Geolocator.distanceBetween(pos.latitude, pos.longitude, m.lat!, m.lng!);
              final distInKm = distInMeters / 1000;
              final distStr = '${distInKm.toStringAsFixed(1)}Km';
              final timeMins = ((distInKm / 30) * 60).ceil();
              return m.copyWith(distance: distStr, timeInMinutes: timeMins);
            }
            return m;
          }).toList();
          
          // Sort by distance
          _allMechanics.sort((a, b) {
             final aDist = a.distance.contains('Km') ? double.parse(a.distance.replaceAll('Km', '')) : double.infinity;
             final bDist = b.distance.contains('Km') ? double.parse(b.distance.replaceAll('Km', '')) : double.infinity;
             return aDist.compareTo(bDist);
          });
        });
      }
    } catch (_) {
      if (mounted) _showMessage('Location access was denied. Search your area instead.');
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  void _searchArea() {
    final v = _searchCtrl.text.trim();
    if (v.isEmpty) return;
    setState(() { _place = v; _searchQuery = v; });
    FocusScope.of(context).unfocus();
  }

  void _showMessage(String text) => ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(text),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );

  // Called when a rating is submitted — update local mechanic rating
  void _onRated(String mechanicId, String newRating) {
    setState(() {
      _allMechanics = _allMechanics.map((m) =>
        m.id == mechanicId ? m.copyWith(rating: newRating) : m,
      ).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final wide    = MediaQuery.sizeOf(context).width > 760;
    final results = _filtered;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1180),
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
                    child: _Header(onAdd: _beginAdd),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: _Hero(
                      search: _searchCtrl,
                      locating: _locating,
                      onSearch: _searchArea,
                      onLocate: _useMyLocation,
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 26, 20, 10),
                    child: _SectionTitle(
                      place: _place,
                      count: results.length,
                      loading: _loading,
                      userPosition: _userPosition,
                      results: results,
                    ),
                  ),
                ),
                if (_loading)
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 30),
                    sliver: SliverGrid(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => const _SkeletonCard(),
                        childCount: wide ? 3 : 2,
                      ),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: wide ? 3 : 1,
                        mainAxisExtent: 240,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                      ),
                    ),
                  )
                else if (results.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 30),
                      child: _EmptyState(
                        place: _place,
                        onAdd: _beginAdd,
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 30),
                    sliver: wide
                        ? SliverGrid(
                            delegate: SliverChildBuilderDelegate(
                              (_, i) => _MechanicCard(
                                mechanic: results[i],
                                onTap:  () => _showDetails(results[i]),
                                onRate: () => _showRateSheet(results[i]),
                              ),
                              childCount: results.length,
                            ),
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 3,
                              mainAxisExtent: 250,
                              crossAxisSpacing: 16,
                              mainAxisSpacing: 16,
                            ),
                          )
                        : SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (_, i) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _MechanicCard(
                                  mechanic: results[i],
                                  onTap:  () => _showDetails(results[i]),
                                  onRate: () => _showRateSheet(results[i]),
                                ),
                              ),
                              childCount: results.length,
                            ),
                          ),
                  ),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: Container(
        color: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _NavIcon(icon: Icons.explore_rounded,      label: 'Explore', active: true),
            _NavIcon(icon: Icons.bookmark_border_rounded, label: 'Saved'),
            _NavIcon(icon: Icons.person_outline_rounded,  label: 'Profile'),
          ],
        ),
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Detail bottom sheet (info + call)
  // -----------------------------------------------------------------------
  void _showDetails(Mechanic m) => showModalBottomSheet(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(m.name,
              style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 24)),
          const SizedBox(height: 6),
          Text('${m.area} · ${m.distance}',
              style: const TextStyle(color: _muted)),
          const SizedBox(height: 16),
          _InfoRow(Icons.build_outlined,   m.specialty),
          _InfoRow(Icons.star_rounded,
              '${m.rating} rating · ${m.ratingCount} vote${m.ratingCount != 1 ? 's' : ''}'),
          const SizedBox(height: 20),
          Row(children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () { Navigator.pop(context); _callMechanic(m.phone); },
                icon: const Icon(Icons.call_outlined),
                label: Text('Call ${m.phone}'),
              ),
            ),
            const SizedBox(width: 10),
            OutlinedButton.icon(
              onPressed: () { Navigator.pop(context); _showRateSheet(m); },
              icon: const Icon(Icons.star_border_rounded),
              label: const Text('Rate'),
              style: OutlinedButton.styleFrom(
                foregroundColor: _forest,
                side: const BorderSide(color: _forest),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              ),
            ),
          ]),
          if (FirebaseAuth.instance.currentUser?.uid == m.createdBy) ...[
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () { Navigator.pop(context); _showMechanicSheet(context, mechanic: m); },
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Edit'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _forest,
                    side: const BorderSide(color: _forest),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () { Navigator.pop(context); _deleteMechanic(m); },
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Delete'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
            ]),
          ],
        ],
      ),
    ),
  );

  Future<void> _deleteMechanic(Mechanic m) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Delete mechanic?'),
        content: Text('Are you sure you want to remove ${m.name}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Delete', style: const TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await FirebaseFirestore.instance.collection('mechanics').doc(m.id).delete();
      setState(() => _allMechanics.removeWhere((item) => item.id == m.id));
      _showMessage('Mechanic deleted.');
    } catch (_) {
      _showMessage('Failed to delete mechanic.');
    }
  }

  // -----------------------------------------------------------------------
  // Rating bottom sheet
  // -----------------------------------------------------------------------
  void _showRateSheet(Mechanic mechanic) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      // Not signed in — show auth sheet first, then come back
      _showAuthSheet(then: () => _showRateSheet(mechanic));
      return;
    }
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetCtx) => _RateSheet(
        mechanic: mechanic,
        user: user,
        onRated: (newRating) {
          _onRated(mechanic.id!, newRating);
          _showMessage('Rating saved — thank you!');
        },
        onError: _showMessage,
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Add mechanic flow
  // -----------------------------------------------------------------------
  Future<void> _beginAdd() async {
    try {
      if (FirebaseAuth.instance.currentUser != null) {
        _showMechanicSheet(context);
        return;
      }
    } catch (_) {}
    _showAuthSheet(then: () => _showMechanicSheet(context));
  }

  void _showAuthSheet({VoidCallback? then}) {
    final formKey = GlobalKey<FormState>();
    final email = TextEditingController();
    final password = TextEditingController();
    var isLogin = true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetCtx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
          padding: EdgeInsets.fromLTRB(
            24, 8, 24, MediaQuery.viewInsetsOf(ctx).bottom + 28),
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.verified_user_outlined, color: _forest, size: 34),
                const SizedBox(height: 12),
                Text(
                  isLogin ? 'Sign in to continue' : 'Create your account',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 23),
                ),
                const SizedBox(height: 7),
                const Text('Sign in to add or rate mechanics.',
                    style: TextStyle(color: _muted)),
                const SizedBox(height: 18),
                _field(email, 'Email address', keyboard: TextInputType.emailAddress),
                const SizedBox(height: 12),
                _field(password, 'Password',
                    keyboard: TextInputType.visiblePassword, obscure: true),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () async {
                      if (!formKey.currentState!.validate()) return;
                      try {
                        if (isLogin) {
                          await FirebaseAuth.instance.signInWithEmailAndPassword(
                            email: email.text.trim(), password: password.text);
                        } else {
                          await FirebaseAuth.instance.createUserWithEmailAndPassword(
                            email: email.text.trim(), password: password.text);
                        }
                        if (!mounted) return;
                        if (sheetCtx.mounted) Navigator.pop(sheetCtx);
                        then?.call();
                      } on FirebaseAuthException catch (e) {
                        if (!mounted) return;
                        _showMessage(e.message ?? 'Could not sign you in.');
                      } catch (_) {
                        if (!mounted) return;
                        _showMessage('Connect Firebase Auth to enable accounts.');
                      }
                    },
                    child: Text(isLogin ? 'Sign in' : 'Create account'),
                  ),
                ),
                TextButton(
                  onPressed: () => setS(() => isLogin = !isLogin),
                  child: Text(
                    isLogin ? 'New here? Create an account'
                             : 'Already have an account? Sign in',
                    style: const TextStyle(color: _forest),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showMechanicSheet(BuildContext ctx, {Mechanic? mechanic}) {
    final formKey = GlobalKey<FormState>();
    final name  = TextEditingController(text: mechanic?.name ?? '');
    final area  = TextEditingController(text: mechanic?.area ?? '');
    final phone = TextEditingController(text: mechanic?.phone ?? '');
    final specialty = TextEditingController(text: mechanic?.specialty != 'General repairs' ? mechanic?.specialty : '');

    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetCtx) => Padding(
        padding: EdgeInsets.fromLTRB(
          24, 8, 24, MediaQuery.viewInsetsOf(sheetCtx).bottom + 28),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(mechanic == null ? 'Add a mechanic' : 'Edit mechanic',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 24)),
              const SizedBox(height: 6),
              Text(mechanic == null ? 'Help drivers find a trusted mechanic in Ghana.' : 'Update details for this mechanic.',
                  style: const TextStyle(color: _muted)),
              const SizedBox(height: 18),
              _field(name,  'Garage or mechanic name'),
              const SizedBox(height: 12),
              _field(area,  'Area / landmark (e.g. Osu, Accra)'),
              const SizedBox(height: 12),
              _field(specialty, 'Specialty (optional) e.g. AC repair', isRequired: false),
              const SizedBox(height: 12),
              _field(phone, 'Phone number', keyboard: TextInputType.phone),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async {
                    if (!formKey.currentState!.validate()) return;
                    
                    final newPhone = phone.text.trim();
                    if (mechanic == null || mechanic.phone != newPhone) {
                      final q = await FirebaseFirestore.instance.collection('mechanics').where('phone', 'isEqualTo', newPhone).get();
                      if (q.docs.isNotEmpty) {
                        if (mounted) _showMessage('A mechanic with this phone number already exists.');
                        return;
                      }
                    }

                    if (mechanic != null) {
                      // Edit
                      try {
                        await FirebaseFirestore.instance.collection('mechanics').doc(mechanic.id).update({
                          'name': name.text.trim(),
                          'area': area.text.trim(),
                          'specialty': specialty.text.trim().isEmpty ? 'General repairs' : specialty.text.trim(),
                          'phone': newPhone,
                        });
                        setState(() {
                          final idx = _allMechanics.indexWhere((m) => m.id == mechanic.id);
                          if (idx != -1) {
                            _allMechanics[idx] = _allMechanics[idx].copyWith(
                              name: name.text.trim(),
                              area: area.text.trim(),
                              specialty: specialty.text.trim().isEmpty ? 'General repairs' : specialty.text.trim(),
                              phone: newPhone,
                            );
                          }
                        });
                        if (sheetCtx.mounted) Navigator.pop(sheetCtx);
                        _showMessage('Mechanic updated!');
                      } catch (_) {
                        if (mounted) _showMessage('Failed to update mechanic.');
                      }
                    } else {
                      // Add
                      final newMech = Mechanic(
                        name:      name.text.trim(),
                        area:      area.text.trim(),
                        specialty: specialty.text.trim().isEmpty ? 'General repairs' : specialty.text.trim(),
                        distance:  '',
                        rating:    'New',
                        phone:     newPhone,
                      );
                      String? newId;
                      final uid = FirebaseAuth.instance.currentUser?.uid;
                      try {
                        final ref = await FirebaseFirestore.instance
                            .collection('mechanics')
                            .add({
                              ...newMech.toMap(),
                              'createdBy': uid,
                            });
                        newId = ref.id;
                      } catch (_) {}
                      if (!mounted) return;
                      setState(() => _allMechanics = [
                            Mechanic(
                              id:        newId,
                              createdBy: uid,
                              name:      newMech.name,
                              area:      newMech.area,
                              specialty: newMech.specialty,
                              distance:  newMech.distance,
                              rating:    newMech.rating,
                              phone:     newMech.phone,
                            ),
                            ..._allMechanics,
                          ]);
                      if (sheetCtx.mounted) Navigator.pop(sheetCtx);
                      _showMessage('Mechanic submitted — thank you!');
                    }
                  },
                  child: Text(mechanic == null ? 'Submit mechanic' : 'Save changes'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _callMechanic(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone.replaceAll(' ', ''));
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      _showMessage('Could not open the dialler for $phone');
    }
  }

  Widget _field(TextEditingController c, String label,
      {TextInputType? keyboard, bool obscure = false, bool isRequired = true}) =>
      TextFormField(
        controller: c,
        keyboardType: keyboard,
        obscureText: obscure,
        validator: (v) =>
            (isRequired && (v == null || v.trim().isEmpty)) ? 'This field is required' : null,
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: const Color(0xFFF3F4EF),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _forest, width: 1.5),
          ),
        ),
      );
}

// ---------------------------------------------------------------------------
// Rating Sheet — stateful bottom sheet with star picker
// ---------------------------------------------------------------------------
class _RateSheet extends StatefulWidget {
  const _RateSheet({
    required this.mechanic,
    required this.user,
    required this.onRated,
    required this.onError,
  });
  final Mechanic  mechanic;
  final User      user;
  final void Function(String newRating) onRated;
  final void Function(String msg) onError;

  @override
  State<_RateSheet> createState() => _RateSheetState();
}

class _RateSheetState extends State<_RateSheet> {
  int  _selected  = 0;
  int  _existing  = 0;
  bool _loading   = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadExisting();
  }

  Future<void> _loadExisting() async {
    final id = widget.mechanic.id;
    if (id == null) { setState(() => _loading = false); return; }
    try {
      final snap = await FirebaseFirestore.instance
          .collection('mechanics').doc(id)
          .collection('ratings').doc(widget.user.uid)
          .get();
      if (snap.exists && mounted) {
        final v = (snap.data()?['value'] as int?) ?? 0;
        setState(() { _existing = v; _selected = v; });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _submit() async {
    if (_selected == 0) return;
    final id = widget.mechanic.id;
    if (id == null) { widget.onError('This listing has no ID yet.'); return; }

    setState(() => _submitting = true);
    try {
      final mechanicRef = FirebaseFirestore.instance.collection('mechanics').doc(id);
      final ratingRef   = mechanicRef.collection('ratings').doc(widget.user.uid);
      String newRating  = widget.mechanic.rating;

      await FirebaseFirestore.instance.runTransaction((tx) async {
        final mSnap = await tx.get(mechanicRef);
        final rSnap = await tx.get(ratingRef);

        final data  = mSnap.data() ?? {};
        int    cnt  = (data['ratingCount'] as int?)    ?? 0;
        double sum  = ((data['ratingSum']  as num?)    ?? 0).toDouble();

        if (rSnap.exists) {
          sum = sum - ((rSnap.data()?['value'] as int?) ?? 0) + _selected;
        } else {
          sum += _selected;
          cnt += 1;
        }

        newRating = cnt > 0
            ? (sum / cnt).toStringAsFixed(1)
            : _selected.toString();

        tx.update(mechanicRef, {
          'rating':      newRating,
          'ratingCount': cnt,
          'ratingSum':   sum,
        });
        tx.set(ratingRef, {
          'value':   _selected,
          'ratedAt': FieldValue.serverTimestamp(),
        });
      });

      setState(() => _existing = _selected);
      widget.onRated(newRating);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      widget.onError('Could not save rating. Please try again.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  static const _labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      24, 8, 24, MediaQuery.viewInsetsOf(context).bottom + 32),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          const Icon(Icons.star_rounded, color: Color(0xFFFFB800), size: 28),
          const SizedBox(width: 8),
          Text('Rate mechanic',
              style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 22)),
        ]),
        const SizedBox(height: 6),
        Text(widget.mechanic.name,
            style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16)),
        Text(widget.mechanic.area,
            style: const TextStyle(color: _muted)),

        if (_existing > 0) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFE7F0D3),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              'You previously gave this $_existing star${_existing != 1 ? 's' : ''}. Tap to update.',
              style: const TextStyle(color: _forest, fontSize: 13),
            ),
          ),
        ],

        const SizedBox(height: 20),

        if (_loading)
          const Center(child: CircularProgressIndicator(color: _forest))
        else ...[
          // Star picker row
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) {
              final n = i + 1;
              return GestureDetector(
                onTap: () => setState(() => _selected = n),
                child: AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 120),
                  style: TextStyle(
                    fontSize: _selected >= n ? 44 : 36,
                    color: _selected >= n
                        ? const Color(0xFFFFB800)
                        : const Color(0xFFD8DED8),
                  ),
                  child: const Text('★'),
                ),
              );
            }),
          ),
          const SizedBox(height: 8),
          Center(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              child: Text(
                key: ValueKey(_selected),
                _selected > 0 ? _labels[_selected] : 'Tap a star to rate',
                style: TextStyle(
                  color: _selected > 0 ? _forest : _muted,
                  fontWeight: _selected > 0 ? FontWeight.w700 : FontWeight.w400,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        ],

        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: (_selected == 0 || _submitting || _loading) ? null : _submit,
            child: Text(_submitting
                ? 'Saving…'
                : _existing > 0 ? 'Update rating' : 'Submit rating'),
          ),
        ),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
class _Header extends StatelessWidget {
  const _Header({required this.onAdd});
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      const _Brand(),
      const Spacer(),
      IconButton(
        onPressed: () => themeNotifier.value = themeNotifier.value == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark,
        icon: ValueListenableBuilder<ThemeMode>(
          valueListenable: themeNotifier,
          builder: (_, mode, __) => Icon(mode == ThemeMode.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
        ),
        color: _forest,
      ),
      TextButton.icon(
        onPressed: onAdd,
        icon: const Icon(Icons.add_location_alt_outlined),
        label: const Text('Add mechanic'),
        style: TextButton.styleFrom(foregroundColor: _forest),
      ),
      const SizedBox(width: 6),
      CircleAvatar(
        backgroundColor: _ink,
        child: IconButton(
          onPressed: () {},
          icon: const Icon(Icons.notifications_none_rounded, color: Colors.white),
        ),
      ),
    ],
  );
}

class _Brand extends StatelessWidget {
  const _Brand();
  @override
  Widget build(BuildContext context) => Row(
    children: [
      const CircleAvatar(
        radius: 20,
        backgroundColor: _forest,
        child: Icon(Icons.handyman_rounded, color: _lime),
      ),
      const SizedBox(width: 9),
      Text('Gears',
        style: GoogleFonts.inter(
          fontSize: 21, fontWeight: FontWeight.w800,
          letterSpacing: -0.5, color: _ink,
        ),
      ),
    ],
  );
}

// ---------------------------------------------------------------------------
// Hero search widget
// ---------------------------------------------------------------------------
class _Hero extends StatelessWidget {
  const _Hero({
    required this.search, required this.locating,
    required this.onSearch, required this.onLocate,
  });
  final TextEditingController search;
  final bool locating;
  final VoidCallback onSearch, onLocate;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(color: _forest, borderRadius: BorderRadius.circular(28)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('A mechanic,\nwhen you need one.',
          style: GoogleFonts.inter(
            color: Colors.white, fontWeight: FontWeight.w800,
            fontSize: 34, height: 1.05, letterSpacing: -1,
          ),
        ),
        const SizedBox(height: 9),
        Text('Search trusted mechanics across Ghana — quick fix or major repair.',
          style: GoogleFonts.inter(color: const Color(0xFFD7E7DB), fontSize: 15, height: 1.35),
        ),
        const SizedBox(height: 22),
        LayoutBuilder(builder: (ctx, box) {
          final row = box.maxWidth > 600;
          final searchBox = TextField(
            controller: search,
            onSubmitted: (_) => onSearch(),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: 'Try "Kumasi", "Tema" or a landmark',
              filled: true, fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(15),
                borderSide: BorderSide.none,
              ),
            ),
          );
          final locate = OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: const BorderSide(color: Color(0xFF73A78E)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
            ),
            onPressed: locating ? null : onLocate,
            icon: locating
                ? const SizedBox(width: 18, height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: _lime))
                : const Icon(Icons.my_location_rounded),
            label: Text(locating ? 'Locating...' : 'Use my location'),
          );
          return row
              ? Row(children: [
                  Expanded(child: searchBox), const SizedBox(width: 10),
                  FilledButton(
                    onPressed: onSearch,
                    style: FilledButton.styleFrom(
                      backgroundColor: _lime, foregroundColor: _ink,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 19),
                    ),
                    child: const Text('Search'),
                  ),
                  const SizedBox(width: 10), locate,
                ])
              : Column(children: [
                  searchBox, const SizedBox(height: 10),
                  Row(children: [
                    Expanded(child: FilledButton(
                      onPressed: onSearch,
                      style: FilledButton.styleFrom(
                        backgroundColor: _lime, foregroundColor: _ink,
                        padding: const EdgeInsets.all(16),
                      ),
                      child: const Text('Search'),
                    )),
                    const SizedBox(width: 10), locate,
                  ]),
                ]);
        }),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
// Section title
// ---------------------------------------------------------------------------
class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.place, 
    required this.count, 
    required this.loading,
    this.userPosition,
    this.results,
  });
  
  final String place; 
  final int count; 
  final bool loading;
  final Position? userPosition;
  final List<Mechanic>? results;

  @override
  Widget build(BuildContext context) {
    String? timeText;
    if (userPosition != null && results != null && results!.isNotEmpty) {
      final validTimes = results!.where((m) => m.timeInMinutes != null).map((m) => m.timeInMinutes!).toList();
      if (validTimes.isNotEmpty) {
        validTimes.sort();
        final minT = validTimes.first;
        final maxT = validTimes.last;
        if (minT == maxT) {
          timeText = 'All Mechanics ~$minT minutes driver from you';
        } else {
          timeText = 'All Mechanics $minT - $maxT minutes driver from you';
        }
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Mechanics near you',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 3),
                Text(
                  loading
                      ? 'Loading mechanics…'
                      : '$count place${count != 1 ? 's' : ''} around $place',
                  style: const TextStyle(color: _muted),
                ),
              ],
            )),
            const Icon(Icons.tune_rounded, color: _forest),
          ],
        ),
        if (timeText != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: _forest),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE6F4EA),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(Icons.location_on, color: _forest, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Use my location to find the mechanics',
                        style: TextStyle(fontWeight: FontWeight.w700, color: _forest, fontSize: 13),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        timeText,
                        style: const TextStyle(color: _muted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Mechanic card (with Rate button)
// ---------------------------------------------------------------------------
class _MechanicCard extends StatelessWidget {
  const _MechanicCard({required this.mechanic, required this.onTap, required this.onRate});
  final Mechanic     mechanic;
  final VoidCallback onTap, onRate;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(20),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFE7F0D3),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: const Icon(Icons.car_repair_rounded, color: _forest),
              ),
              const Spacer(),
              if (mechanic.open)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE9F7E8),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text('Open',
                    style: TextStyle(color: _forest, fontWeight: FontWeight.w700, fontSize: 12)),
                ),
            ]),
            const Spacer(),
            Text(mechanic.name,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
              maxLines: 1, overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 3),
            Text(mechanic.area,
              style: const TextStyle(color: _muted),
              maxLines: 1, overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            // Star display
            _StarRow(rating: mechanic.rating, count: mechanic.ratingCount),
            const SizedBox(height: 8),
            // Actions row
            Row(children: [
              Expanded(
                child: Text(mechanic.specialty,
                  style: const TextStyle(fontSize: 12, color: _forest, fontWeight: FontWeight.w600),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                ),
              ),
              GestureDetector(
                onTap: onRate,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFD8DED8)),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: const Text('★ Rate',
                    style: TextStyle(color: _forest, fontWeight: FontWeight.w700, fontSize: 12)),
                ),
              ),
            ]),
          ],
        ),
      ),
    ),
  );
}

// Compact star row shown on cards
class _StarRow extends StatelessWidget {
  const _StarRow({required this.rating, required this.count});
  final String rating; final int count;
  @override
  Widget build(BuildContext context) {
    final num = double.tryParse(rating);
    final filled = num != null ? num.round().clamp(0, 5) : 0;
    return Row(children: [
      ...List.generate(5, (i) => Icon(
        i < filled ? Icons.star_rounded : Icons.star_outline_rounded,
        color: i < filled ? const Color(0xFFFFB800) : const Color(0xFFD8DED8),
        size: 16,
      )),
      const SizedBox(width: 5),
      Text(
        num != null ? '${num.toStringAsFixed(1)}  ($count)' : 'New',
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _muted),
      ),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Skeleton loading card
// ---------------------------------------------------------------------------
class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _shimmer(48, 48, radius: 15),
      const Spacer(),
      _shimmer(14, double.infinity),
      const SizedBox(height: 8),
      _shimmer(12, 140),
      const SizedBox(height: 10),
      _shimmer(12, 100),
    ]),
  );

  Widget _shimmer(double h, double w, {double radius = 8}) => Container(
    height: h, width: w,
    margin: const EdgeInsets.only(bottom: 4),
    decoration: BoxDecoration(
      color: const Color(0xFFE8EEE8),
      borderRadius: BorderRadius.circular(radius),
    ),
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.place, required this.onAdd});
  final String place; final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 24),
      child: Column(children: [
        const Text('🔧', style: TextStyle(fontSize: 48)),
        const SizedBox(height: 16),
        Text('No mechanics found near "$place"',
          style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        const Text('Be the first to add one!',
          style: TextStyle(color: _muted),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add_location_alt_outlined),
          label: const Text('Add mechanic'),
        ),
      ]),
    ),
  );
}

// ---------------------------------------------------------------------------
// Info row (detail sheet)
// ---------------------------------------------------------------------------
class _InfoRow extends StatelessWidget {
  const _InfoRow(this.icon, this.text);
  final IconData icon; final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(children: [
      Icon(icon, color: _forest),
      const SizedBox(width: 12),
      Expanded(child: Text(text)),
    ]),
  );
}

// ---------------------------------------------------------------------------
// Bottom nav icon
// ---------------------------------------------------------------------------
class _NavIcon extends StatelessWidget {
  const _NavIcon({required this.icon, required this.label, this.active = false});
  final IconData icon; final String label; final bool active;
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, color: active ? _forest : const Color(0xFF7A827C)),
      Text(label, style: TextStyle(
        fontSize: 11,
        color: active ? _forest : const Color(0xFF7A827C),
        fontWeight: active ? FontWeight.w700 : FontWeight.w400,
      )),
    ],
  );
}
