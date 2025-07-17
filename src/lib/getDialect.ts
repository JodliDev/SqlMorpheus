import SqliteDialect from "./dialects/SqliteDialect";
import PostgresDialect from "./dialects/PostgresDialect";
import MsSqlDialect from "./dialects/MsSqlDialect";
import MySqlDialect from "./dialects/MySqlDialect";
import DatabaseInstructions from "./typings/DatabaseInstructions";

export default function getDialect(dbInstructions: DatabaseInstructions) {
	switch(dbInstructions.dialect) {
		case "Sqlite":
			return new SqliteDialect();
		case "Postgres":
			return new PostgresDialect();
		case "MsSql":
			return new MsSqlDialect();
		case "MySql":
			return new MySqlDialect();
		default:
			throw new Error(`Unknown dialect ${dbInstructions.dialect}`);
	}
}