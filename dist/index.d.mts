interface DatabaseAccess {
    createBackup?(name: string): Promise<void>;
    runGetStatement(query: string): Promise<unknown>;
    runMultipleWriteStatements(query: string): Promise<void>;
}

type Class<T> = new (...args: never[]) => T;
/**
 * This does nothing. It mainly exists in case we want to filter class types in the future
 */
type BackendTable = {
    [key: string]: any;
};

interface AllowedMigrations {
    recreateTable?: boolean;
    dropTable?: boolean;
    dropColumn?: boolean;
    alterPrimaryKey?: boolean;
    removeForeignKey?: boolean;
    alterForeignKey?: boolean;
    continueWithoutRollback?: boolean;
}

interface MigrationInstructions {
    oldTableName?: string;
    recreate: boolean;
    /**
     * Stores changes to column (0: name in the database, last: current name in code)
     */
    renamedColumns: string[][];
    allowedMigrations: Record<number, AllowedMigrations>;
}

declare class Migrations {
    private readonly migrationData;
    private alwaysAllowed;
    private getEntry;
    private getTableName;
    alwaysAllow(...allowedMigrations: (keyof AllowedMigrations)[]): void;
    allowMigration(version: number, table: string | Class<BackendTable>, ...allowedMigrations: (keyof AllowedMigrations)[]): void;
    throwIfNotAllowed(version: number, tableName: string, type: keyof AllowedMigrations): void;
    renameTable(oldTableName: string, newTable: string | Class<BackendTable>): void;
    renameColumn(table: string | Class<BackendTable>, oldColumn: string, newColumn: string): void;
    recreateTable(table: Class<BackendTable> | string): void;
    getMigrationData(): Record<string, MigrationInstructions>;
    loopRenamedColumns(tableName: string, callback: (oldColumnName: string, newColumnName: string) => void): void;
    getUpdatedColumnName(tableName: string, oldColumnName: string): string;
    willBeRecreated(tableName: string): boolean;
}
type PublicMigrations = Pick<Migrations, "recreateTable" | "renameTable" | "renameColumn" | "allowMigration" | "alwaysAllow">;

interface SqlChanges {
    up: string;
    down: string;
}

type ForeignKeyActions = "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION" | "CASCADE";
interface ForeignKeyInfo {
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
    onUpdate?: ForeignKeyActions;
    onDelete?: ForeignKeyActions;
}

interface TableInfo {
    primaryKey?: string;
    foreignKeys?: ForeignKeyInfo[];
}

type TableObjects = Record<string, {
    columns: BackendTable;
    tableInfo?: TableInfo;
}>;

interface DatabaseInstructions {
    dialect: "Sqlite" | "MsSql" | "MySql" | "Postgres";
    tables: Class<BackendTable>[] | TableObjects;
    version: number;
    configPath: string;
    loggerMode?: "silent" | "noLog" | "normal" | "debug";
    /**
     * Custom migrations that will run before any database changes are applied.
     * @param migrations The migration object that will be validated after this.
     * @param fromVersion Version of the current database.
     * @param toVersion Version of the database after update.
     * @return custom SQL that should be executed before migrations are executed.
     */
    preMigration?(migrations: PublicMigrations, fromVersion: number, toVersion: number): SqlChanges | void;
    /**
     * Custom migrations that will run after database changes have been applied (but before the transaction is finished)
     * @param fromVersion Version of the current database.
     * @param toVersion Version of the database after update.
     * @return custom SQL that should be executed before migrations are executed.
     */
    postMigration?(fromVersion: number, toVersion: number): SqlChanges;
}

declare function DbTable<T extends BackendTable>(tableName: string, primaryKey?: keyof T): (table: Class<T>, context: any) => void;

declare function ForeignKey<TOther extends BackendTable>(toTable: Class<TOther>, toColumn: keyof TOther, onDelete?: ForeignKeyActions, onUpdate?: ForeignKeyActions): (_: undefined, context: any) => void;

declare async function prepareMigration(db: DatabaseAccess, dbInstructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void>;
declare async function runPreparedMigrations(db: DatabaseAccess, dbInstructions: DatabaseInstructions);
declare async function prepareAndRunMigration(db: DatabaseAccess, dbInstructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void>;
declare async function rollback(db: DatabaseAccess, dbInstructions: DatabaseInstructions, toVersion: number);

export { DbTable, ForeignKey, prepareAndRunMigration, prepareMigration, rollback, runPreparedMigrations };
