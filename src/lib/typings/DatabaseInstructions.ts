import {Class, BackendTable} from "./BackendTable.ts";
import {PublicMigrations} from "./Migrations.ts";
import {SqlChanges} from "./SqlChanges.ts";
import TableInfo from "../tableInfo/TableInfo.ts";


export default interface DatabaseInstructions {
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

export type TableObjects = Record<string, {columns: BackendTable, tableInfo?: TableInfo}>;