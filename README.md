# SqlMorpheus

SQLMorpheus is a standalone SQL migration tool that automatically calculates the differences between a database and a defined state and updates the database structure accordingly. It is not bundled with any ORM or limited to a specific SQL dialect or SQL library making it very flexible and easy to integrate into any (new or preexisting) project.

Its stand-out features are:
- Database **changes are calculated at runtime**, allowing SqlMorpheus to be used with different database states without expecting any existing structure or having to recompile your app.
- SQLMorpheus **does not bundle its own SQL library** but allows you to define database access yourself using any library you want. This not only prevents unnecessary overhead, it also makes SQLMorpheus very flexible and easy to migrate between database flavours.
- While SQLMorpheus can work without (almost) any manual input, it optionally **allows for destructive changes to be confirmed** to prevent possible data loss.
- It **keeps a history of changes** (and adds an interface for backups before migrations) and allows viewing all changes made and even roll back to a specific version.


## How to install?
To install SqlMorpheus run
```bash
npm install sqlmorpheus
```

## How to use?

Because SqlMorpheus relies on the framework you choose for database access, it needs a little bit more setup code. But you only need to copy & paste a few simple lines of code:

### 1. Access the database
For SqlMorpheus to be able to access your database, you need to provide its `runMigration` call (see bellow) with an object with three callback functions: `runReadStatement()`, `runWriteStatement()` and `runTransaction()`.
Here is a full example for SQLite using better-sqlite3
For other SQL types you can copy one of the provided examples (see [MySQL](/examples/DatabaseAccess_for_MySQL.md), [Postgres](/examples/DatabaseAccess_for_Postgres.md), [SQLite](/examples/DatabaseAccess_for_SQLite.md)) 

```typescript
import {DatabaseAccess, runMigration} from "sqlmorpheus";
import BetterSqlite3 from "better-sqlite3";

const db = new BetterSqlite3(":memory:");
const dbAccess: DatabaseAccess = {
    runReadStatement: async (query: string) => db.prepare(query).all(), 
    runWriteStatement: async (query: string) => db.prepare(query).run(), 
    runTransaction: async (query: string) => {
        const transaction = db.transaction(() => db.exec(query));
        transaction();
    }
}
```

#### Optional: `createBackup()` in DatabaseAccess
On top of the three mandatory methods, you can also define `createBackup()`. This callback is called whenever the `version` in `DatabaseInstructions` has changed and SqlMorpheus needs to change the database. An example implementation for a backup in SQLite would be:

```typescript
const dbAccess: DatabaseAccess = {
    ...,
    createBackup: async (backupName: string) => {
        await db.backup(`backups/${backupName}.sqlite`)
    }
}
```


### 2. Define the database structure
This part might require the most work from you, but should be familiar to you if you have already used other migration libraries: You need to tell SqlMorpheus what structure it should mold your database into. To make this process as simple as possible, SqlMorpheus provides a convenient `TableObj.create()` builder (see [TableObj example](/examples/database_structure_using_TableObj.md)) or, if you prefer, you can also use decorators (see [decorator example](/examples/database_structure_using_decorators.md)).
Here is an example using `TableObj.create()`:
```typescript
import {DatabaseAccess, runMigration} from "sqlmorpheus";
const usersTable = TableObj.create("User", {
    userId: [0, {primaryKey: true}], 
    name: "Default name", 
    email: [null, {dataType: "string"}]
});
const messagesTable = TableObj.create("Message", {
    messageId: [0, {primaryKey: true}], 
    from: 0,
    to: 0, 
    content: ""
})
    .foreignKey("from", usersTable, "userId", {onDelete: "CASCADE"})
    .foreignKey("to", usersTable, "userId", {onDelete: "CASCADE"});
```

### 3. Define the database instructions
Now we combine everything and call `runMigration()`
Example:
```typescript
const instructions: DatabaseInstructions = {
    dialect: "Sqlite", 
    tables: [userTable, messagesTable], // usersTable and messagesTable are defined above 
    version: 1
};

await runMigration(dbAccess, instructions); // dbAccess is defined above
```

You can define the following properties for `DatabaseInstructions`:

#### `version`
SqlMorpheus will only compare the database structure, when the database version is different to the version property defined in DatabaseInstructions. The version property is also used to decide which manual migrations defined in `preMigration()` should be executed.

#### `preMigration()`
This method is run before database migrations (and comparisons) are executed. This is also the place where you allow specific destructive migrations or tell SqlMorpheus that you want to rename a table or column (rather than removing and adding it – which would be the default behaviour).

#### `postMigration()`
This method is run after the migration was finished. You will very rarely need it.

## When does SqlMorpheus check for migrations?
SqlMorpheus will only compare the database when the [version property](#version) is different to the version saved in the database itself (or if the database has no version defined at all).

## How to rename a table or column?
SqlMorpheus has no way of telling if you want to rename a table / column or want to remove it and add a completely new one. To solve this, it relies on your input to tell it what to do (by default it just removes and adds a table / column).
To tell it to rename a table / column, you call `migration.renameTable(VERSION, "OLD_TABLENAME", "NEW_TABLENAME");` in `preMigration()` ([example](/examples/example_renaming.md))

## rollback your database
SqlMorpheus saves its changes into the database (into a table called `__sqlmorpheus_migrations`) which allows you to roll back the database to a previous state with a single command:

```typescript
// `dbAccess` and `instructions` are defined above
await rollback(dbAccess, TARGET_VERSION, instructions.dialect);
```