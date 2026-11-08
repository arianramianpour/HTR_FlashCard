# Online Flashcards

A simple online flashcard app inspired by AnkiDroid. Students can organize their own vocabulary, study cards in both directions, and track their progress. The interface should be clean and easy to use on desktop and mobile.

## Technology

- **Backend:** Node.js
- **Database:** MariaDB
- **Interface languages:** English, Persian, and Korean. Persian needs right-to-left layout support.

The exact framework and hosting setup can be selected when implementation begins.

## Roles

- **Admin:** manages users and roles, and creates and manages shared templates.
- **Teacher:** creates and manages shared templates for students.
- **Student:** creates personal folders, imports or adds cards, uses templates, and studies cards.

Each user owns their personal folders. Shared templates are reusable starting points; using one creates a personal copy so a student can change it without affecting the original. Admins and teachers can also use personal folders.

## Folders and cards

- Each user can create multiple folders.
- Each folder holds up to **300 flashcards**.
- A card contains a word and its meaning. The data model should allow an example and other optional fields later.
- Users can add and edit cards manually, import them from a file, or create a folder from a shared template.
- Users can mark cards as important and review them later.

## Import

Support UTF-8 text and JSON files. A text file uses one card per line, with the word and meaning separated by a comma:

```text
apple,سیب
book,کتاب
```

A JSON file can use an array of objects:

```json
[
  { "word": "apple", "meaning": "سیب" },
  { "word": "book", "meaning": "کتاب" }
]
```

The import screen should preview cards, report invalid lines or entries, and enforce the 300-card folder limit. CSV-style quoted values should allow commas within a word or meaning. Exact handling of duplicates can be decided during implementation.

## Study flow

1. Choose a folder and start a session. The default session includes up to **25 cards**; smaller folders use the cards available.
2. Show either the word or its meaning, varying the direction so the learner practices recall both ways.
3. The learner thinks of the answer and selects **Show answer**.
4. Show three actions: **Yes**, **No**, and **Add to important**. Yes records a correct answer; No records an incorrect answer and puts the card back into the session for extra practice. Add to important marks the card for later review.
5. Incorrect cards should be shown again until the learner has answered them correctly three times during the session, with direction varied when possible. The exact spacing and whether these successes must be consecutive can be refined before implementation.
6. Show a short session summary with progress and rewards.

Important is a separate flag from correctness. The study screen should make it clear how to continue after marking a card important.

## Simple rewards

Give learners points for completed study sessions and correct answers, and show a simple progress indicator or milestone. Rewards should encourage practice without making the app complicated. Point values and milestones will be decided during implementation.

## Proposed database

Keep the initial schema small, with ownership and relationships enforced by foreign keys:

- **users:** account details, password hash, role, preferred language, and reward points.
- **folders:** owner, name, and creation date.
- **cards:** folder, word, meaning, important flag, and optional example.
- **templates:** creator, title, description, and visibility/status.
- **template_cards:** template, word, meaning, and optional example.
- **study_sessions:** user, folder, start/end times, and summary counts.
- **card_progress:** user/card study statistics and last-reviewed time.

The 300-card limit applies when adding cards, importing, and copying a template. Session-specific retry state can initially be kept in the application; persistent session details can be added if needed. Passwords must be stored as secure hashes, and authorization must protect personal data and template management.

## Future integrations

Reserve a clear place in the design for optional translation services, without implementing them in the first version:

- Automatic translation API.
- AI translation API.
- AI-generated example sentences.
- A one-click bulk action to translate words in a folder, with a review step before saving results.

Provider choice, API credentials, cost controls, and integration details will be decided later.

## Initial scope

Build the first version around accounts and roles, personal folders, card management and import, shared templates, reversible study sessions, important cards, basic rewards, and the three interface languages. This README records the idea; implementation comes next.

## Getting started

### Requirements

- Node.js 18 or newer and npm.
- A running MariaDB server and an account allowed to create and use the application database.

1. Create the database and tables by running `schema.sql` with a MariaDB account that has permission to create databases:

   ```sh
   mariadb -u root -p < schema.sql
   ```

2. Create a MariaDB user with access to the `flashcards` database, or use an existing appropriately restricted account.
3. Copy `.env.example` to `.env` and enter the database connection details. `DB_NAME` should match the database created by the schema.
4. Run `npm install` and then `npm start`.
5. Open `http://localhost:3000` and register an account. New accounts start as students.
6. To make an existing account the first administrator, run `node promote-admin.js email@example.com` from the project directory. An administrator can change other users' roles from the People page. Teachers and administrators can publish a personal folder as a template.

For development, `npm run dev` restarts the server when server files change. In a deployment, use HTTPS and set `COOKIE_SECURE=true`. Keep `.env` private.

### Current behavior and limits

A study session selects up to 25 cards at random. A missed card returns to the queue and must subsequently receive three correct answers; another miss resets its requirement to three. Marking a card important does not answer it. A completed session earns one point per correct answer plus five completion points. Leaving a session early discards that session's progress.

Template copies are independent personal folders. The import preview accepts a JSON array or comma-separated text with quoted fields, without a header row. A folder cannot exceed 300 cards. Translation and AI features are future work and have no API integration yet.

The application is a first version: before exposing it publicly, add production controls such as login rate limiting, password reset and email verification, backup/restore, deployment monitoring, and an external security review. Session records remain in MariaDB until removed; expiration is enforced when they are used.

### Code formatting

After installing dependencies, run `npm run format` to format the JavaScript, HTML, CSS, JSON, and Markdown files with Prettier. Run `npm run format:check` to check formatting without changing files.

### Frontend structure

- `public/lang/` contains one translation file per supported language. Add matching keys to all three files when changing interface text.
- `public/pages/` contains the authentication, folder, import, study, template, and user-management screens.
- `public/shared.js` contains shared state, API calls, and interface helpers; `public/app.js` starts the app and switches between screens.
- `public/index.html` loads these scripts in order using `defer`. New scripts must be added there before they can run.
