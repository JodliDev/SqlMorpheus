import {TableClassInterface, Class} from "./TableClassInterface";
import {PublicMigrations} from "../Migrations";
import {SqlChanges} from "./SqlChanges";
import {TableObjInput} from "../tableInfo/TableObj";
import {AllowedMigrations} from "./AllowedMigrations";
import {DatabaseAccess} from "./DatabaseAccess";
import {LoggerMode} from "../Logger";

export type TableInput = TableObjInput | Class<TableClassInterface>;

export default interface DatabaseInstructions {
	dialect: "Sqlite" | "MsSql" | "MySql" | "Postgres";
	tables: TableInput[];
	version: number;
	/**
	 * Usually SqlMorpheus throws an exception if it needs to execute a destructive database change and is not explicitly confirmed in
	 * (using `allowMigration()` in `preMigration()`).
	 * if true, no exception will be thrown and an error message will be logged to the console instead.
	 */
	doNotThrowIfNotAllowed?: boolean;
	
	/**
	 * Defines how much should be logged to the console.
	 */
	loggerMode?: LoggerMode;
	
	/**
	 * Usually SqlMorpheus throws an exception if it needs to execute a destructive database change and is not explicitly allowed to do so
	 * (using `allowMigration()` in `preMigration()`).
	 * if defined, the confirmation will be skipped for each migration type defined in `alwaysAllowedMigrations`.
	 */
	alwaysAllowedMigrations?: (keyof AllowedMigrations)[];
	
	/**
	 * Custom migrations that will run before any database changes are applied.
	 * @param migrations - The migration object that will be validated after this.
	 * @param dbAccess - The database access object to interact with the database.
	 * @param fromVersion - Version of the current database.
	 * @param toVersion - Version of the database after update.
	 * @return custom SQL that should be executed before migrations are executed.
	 */
	preMigration?(migrations: PublicMigrations, dbAccess: DatabaseAccess, fromVersion: number, toVersion: number): SqlChanges | void;
	
	/**
	 * Custom migrations that will run after database changes have been applied (but before the transaction is finished)
	 * @param dbAccess - The database access object to interact with the database.
	 * @param fromVersion - Version of the current database.
	 * @param toVersion - Version of the database after update.
	 * @return custom SQL that should be executed after migrations were executed.
	 */
	postMigration?(dbAccess: DatabaseAccess, fromVersion: number, toVersion: number): SqlChanges;
}

