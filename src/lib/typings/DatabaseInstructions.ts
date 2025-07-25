import {TableClassInterface, Class} from "./TableClassInterface";
import {PublicMigrations} from "../Migrations";
import {SqlChanges} from "./SqlChanges";
import AllowedMigrations from "./AllowedMigrations";
import {TableObjInput} from "../tableInfo/TableObj";


export type TableInput = TableObjInput | Class<TableClassInterface>;

export default interface DatabaseInstructions {
	dialect: "Sqlite" | "MsSql" | "MySql" | "Postgres";
	tables: TableInput[];
	version: number;
	configPath: string;
	throwIfNotAllowed: boolean;
	loggerMode?: "silent" | "noLog" | "normal" | "debug";
	alwaysAllowedMigrations?: AllowedMigrations;
	
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

