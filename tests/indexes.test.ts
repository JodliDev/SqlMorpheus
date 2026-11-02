import {beforeEach, describe, expect, it} from "vitest";
import BetterSqlite3 from "better-sqlite3";
import {DatabaseAccess, Index, PublicMigrations, rollback, runMigration, TableClass} from "../src/index.ts";
import TableObj from "../src/lib/tableInfo/TableObj.ts";
import SqliteDialect from "../src/lib/dialects/SqliteDialect.ts";
import NotAllowedException from "../src/lib/exceptions/NotAllowedException.ts";
import TableStructureGenerator from "../src/lib/TableStructureGenerator.ts";
import {Migrations} from "../src/lib/Migrations.ts";
import DatabaseInstructions from "../src/lib/typings/DatabaseInstructions.ts";

function createAccess(): DatabaseAccess {
	const db = new BetterSqlite3(":memory:");
	return {
		runReadStatement: async (query: string) => db.prepare(query).all(),
		runWriteStatement: async (query: string) => db.prepare(query).run(),
		runTransaction: async (query: string) => {
			const transaction = db.transaction(() => db.exec(query));
			transaction();
		}
	}
}

function usersTable(indexes: {columns: ("id" | "name" | "email")[], name?: string, unique?: boolean}[], columns: Record<string, unknown> = {email: ""}) {
	let table = TableObj.create("Users", {id: [0, {primaryKey: true}], name: "", ...columns} as any) as any;
	for(const index of indexes) {
		table = table.index(index.columns, {name: index.name, unique: index.unique});
	}
	return table.sealType();
}

describe("Indexes", () => {
	let access: DatabaseAccess;
	let dialect: SqliteDialect;

	beforeEach(() => {
		access = createAccess();
		dialect = new SqliteDialect(access);
	});

	it("should create indexes with new tables", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([{columns: ["name"]}, {columns: ["email", "name"], name: "unique_mail", unique: true}])]});

		expect(await dialect.getIndexes("Users")).toEqual([
			{name: "Users_name_idx", columns: ["name"], isUnique: false},
			{name: "unique_mail", columns: ["email", "name"], isUnique: true},
		]);

		await access.runTransaction(`INSERT INTO Users (name, email) VALUES ('a', 'a@a')`);
		await expect(access.runTransaction(`INSERT INTO Users (name, email) VALUES ('a', 'a@a')`)).rejects.toThrow();
	});

	it("should create indexes using decorators", async() => {
		@TableClass("Decorated", "id")
		@Index<DecoratedTable>(["name", "age"], {unique: true})
		class DecoratedTable {
			id = 0;
			name = "";
			age = 0;
		}

		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [DecoratedTable]});

		expect(await dialect.getIndexes("Decorated")).toEqual([
			{name: "Decorated_name_age_idx", columns: ["name", "age"], isUnique: true},
		]);
	});

	it("should add an index to an existing table without confirmation", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([])]});
		await runMigration(access, {dialect: "Sqlite", version: 2, tables: [usersTable([{columns: ["email"]}])]});

		expect(await dialect.getIndexes("Users")).toEqual([{name: "Users_email_idx", columns: ["email"], isUnique: false}]);

		await rollback(access, 1, "Sqlite");
		expect(await dialect.getIndexes("Users")).toEqual([]);
	});

	it("should not drop an index without confirmation", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([{columns: ["email"]}])]});

		await expect(
			runMigration(access, {dialect: "Sqlite", version: 2, tables: [usersTable([])]})
		).rejects.toThrow(new NotAllowedException([{version: 2, tableName: "Users", type: "dropIndex", column: "Users_email_idx"}]));
		expect(await dialect.getIndexes("Users")).toHaveLength(1);
	});

	it("should drop an index when allowed and restore it on rollback", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([{columns: ["email"]}])]});
		await runMigration(access, {
			dialect: "Sqlite",
			version: 2,
			tables: [usersTable([])],
			preMigration: (migrations: PublicMigrations) => {
				migrations.allowMigration(2, "Users", "dropIndex", "Users_email_idx");
			}
		});
		expect(await dialect.getIndexes("Users")).toEqual([]);

		await rollback(access, 1, "Sqlite");
		expect(await dialect.getIndexes("Users")).toEqual([{name: "Users_email_idx", columns: ["email"], isUnique: false}]);
	});

	it("should drop an index when dropIndex is always allowed", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([{columns: ["email"]}])]});
		await runMigration(access, {dialect: "Sqlite", version: 2, tables: [usersTable([])], alwaysAllowedMigrations: ["dropIndex"]});

		expect(await dialect.getIndexes("Users")).toEqual([]);
	});

	it("should require confirmation when an index is changed", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([{columns: ["email"], name: "my_index"}])]});

		await expect(
			runMigration(access, {dialect: "Sqlite", version: 2, tables: [usersTable([{columns: ["email"], name: "my_index", unique: true}])]})
		).rejects.toThrow(NotAllowedException);

		await runMigration(access, {
			dialect: "Sqlite",
			version: 2,
			tables: [usersTable([{columns: ["email"], name: "my_index", unique: true}])],
			preMigration: (migrations: PublicMigrations) => {
				migrations.allowMigration(2, "Users", "dropIndex", "my_index");
			}
		});
		expect(await dialect.getIndexes("Users")).toEqual([{name: "my_index", columns: ["email"], isUnique: true}]);

		await rollback(access, 1, "Sqlite");
		expect(await dialect.getIndexes("Users")).toEqual([{name: "my_index", columns: ["email"], isUnique: false}]);
	});

	it("should drop an index before dropping its column", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([{columns: ["email"]}])]});
		await runMigration(access, {
			dialect: "Sqlite",
			version: 2,
			tables: [usersTable([], {})],
			preMigration: (migrations: PublicMigrations) => {
				migrations.allowMigration(2, "Users", "dropColumn", "email");
				migrations.allowMigration(2, "Users", "dropIndex", "Users_email_idx");
			}
		});
		expect(await dialect.getIndexes("Users")).toEqual([]);

		await rollback(access, 1, "Sqlite");
		expect(await dialect.getIndexes("Users")).toEqual([{name: "Users_email_idx", columns: ["email"], isUnique: false}]);
	});

	it("should create an index on a new column after the column was added", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([], {})]});
		await runMigration(access, {dialect: "Sqlite", version: 2, tables: [usersTable([{columns: ["email"]}])]});

		expect(await dialect.getIndexes("Users")).toEqual([{name: "Users_email_idx", columns: ["email"], isUnique: false}]);

		await rollback(access, 1, "Sqlite");
		expect(await dialect.getColumnInformation("Users")).not.toHaveProperty("email");
	});

	it("should keep an index on a renamed column without confirmation", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([{columns: ["email"], name: "mail_index"}])]});

		await runMigration(access, {
			dialect: "Sqlite",
			version: 2,
			tables: [usersTable([{columns: ["mail" as any], name: "mail_index"}], {mail: ""})],
			preMigration: (migrations: PublicMigrations) => {
				migrations.renameColumn(2, "Users", "email", "mail");
			}
		});
		expect(await dialect.getIndexes("Users")).toEqual([{name: "mail_index", columns: ["mail"], isUnique: false}]);
	});

	it("should rename generated index names without confirmation when a table is renamed", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([{columns: ["email"]}])]});

		await runMigration(access, {
			dialect: "Sqlite",
			version: 2,
			tables: [TableObj.create("Accounts", {id: [0, {primaryKey: true}], name: "", email: ""}).index(["email"]).sealType()],
			preMigration: (migrations: PublicMigrations) => {
				migrations.renameTable(2, "Users", "Accounts");
			}
		});
		expect(await dialect.getIndexes("Accounts")).toEqual([{name: "Accounts_email_idx", columns: ["email"], isUnique: false}]);
	});

	it("should keep indexes when a table is recreated", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([{columns: ["email"]}])]});
		await runMigration(access, {
			dialect: "Sqlite",
			version: 2,
			tables: [usersTable([{columns: ["email"]}, {columns: ["name"]}], {email: 0})], //changed type leads to recreation in Sqlite
			preMigration: (migrations: PublicMigrations) => {
				migrations.allowMigration(2, "Users", "recreateTable");
			}
		});
		expect(await dialect.getIndexes("Users")).toEqual([
			{name: "Users_email_idx", columns: ["email"], isUnique: false},
			{name: "Users_name_idx", columns: ["name"], isUnique: false},
		]);

		await rollback(access, 1, "Sqlite");
		expect(await dialect.getIndexes("Users")).toEqual([{name: "Users_email_idx", columns: ["email"], isUnique: false}]);
	});

	it("should restore indexes of a dropped table on rollback", async() => {
		await runMigration(access, {dialect: "Sqlite", version: 1, tables: [usersTable([{columns: ["email"]}])]});
		await runMigration(access, {dialect: "Sqlite", version: 2, tables: [], alwaysAllowedMigrations: ["dropTable"]});

		await rollback(access, 1, "Sqlite");
		expect(await dialect.getIndexes("Users")).toEqual([{name: "Users_email_idx", columns: ["email"], isUnique: false}]);
	});

	describe("validation", () => {
		const generate = (tables: DatabaseInstructions["tables"]) =>
			new TableStructureGenerator({dialect: "Sqlite", version: 1, tables: tables}, dialect).generateTableStructure();

		it("should throw for unknown columns", () => {
			expect(() => generate([usersTable([{columns: ["unknown" as any]}])])).toThrow("does not exist");
		});

		it("should throw for duplicate index names", () => {
			const other = TableObj.create("Other", {email: ""}).index(["email"], {name: "same"}).sealType();
			expect(() => generate([usersTable([{columns: ["email"], name: "same"}]), other])).toThrow("Index names need to be unique");
		});

		it("should throw for index names that are too long", () => {
			expect(() => generate([usersTable([{columns: ["email"], name: "a".repeat(64)}])])).toThrow("longer than 63");
		});

		it("should require an index name for dropIndex", () => {
			const migrations = new Migrations();
			migrations.reset({dialect: "Sqlite", version: 2, tables: []}, 1);
			expect(() => migrations.allowMigration(2, "Users", "dropIndex")).toThrow("requires an index name");
		});
	});
});
