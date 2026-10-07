# Wasteland Survivor - Automatic Next Steps

## Completed In This Build

- Redesigned Nightfall welcome and Choose Your Fight screens.
- Working Back controls for lobby, profile editing, dashboard, settings, and armory.
- Six indexed survivor avatar images.
- Eight indexed radioactive enemy images.
- Cinematic survivor-versus-mutant lobby backdrop.
- Automatic local 12-second gameplay clip capture.
- Six-clip rotating home-screen replay library stored in IndexedDB.
- Combat, classes, enemy AI, campaign progression, store rules, scoring, backend, operator console, sessions, recovery challenges, rate limiting, and Firestore adapter.

## Next Automatic Development Pass

1. Replace character-sheet crops with independently posed front, side, and action renders.
2. Add avatar portrait cards with keyboard, touch, and controller selection.
3. Apply enemy portraits to wave warnings and boss introductions.
4. Add replay controls: skip, favorite, delete, and disable automatic recording.
5. Add local highlight detection for eliminations, bosses, and match victories.
6. Build server-authoritative movement, damage, scoring, and reconnect snapshots.
7. Connect Firestore using Google Application Default Credentials.
8. Connect a verified email or SMS provider before enabling recovery delivery.
9. Run phone, desktop, and physical Xbox controller regression testing.
10. Deploy only after the local acceptance checklist passes.

## Production Environment Variables

- `SESSION_SECRET`: long random production secret.
- `ADMIN_TOKEN`: separate operator-console secret.
- `FIRESTORE_PROJECT_ID`: Google Cloud project ID.
- `FIRESTORE_DATABASE_ID`: optional non-default Firestore database.
- `FIRESTORE_COLLECTION`: optional backend collection name.
- `FIRESTORE_DOCUMENT`: optional environment document name.

Never place passwords, PINs, recovery tokens, API keys, birth dates, email addresses, phone numbers, or Google credentials in public game files.
