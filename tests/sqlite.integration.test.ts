
import {test, describe, expect, beforeEach} from "vitest";
import BetterSqlite3 from "better-sqlite3";
import * as fs from "node:fs";
import DatabaseInstructions from "../src/lib/typings/DatabaseInstructions";
import {prepareAndRunMigration, PublicMigrations, SqlChanges} from "../src";

describe("Integration tests", () => {
	const configPath = `${process.cwd()}/config/`;
	
	beforeEach(() => {
		const migrationPath = `${configPath}migrations`;
		const versionPath = `${configPath}last_version.txt`;
		
		if(fs.existsSync(migrationPath))
			fs.rmSync(migrationPath, { recursive: true, force: true });
		if(fs.existsSync(versionPath))
			fs.rmSync(versionPath);
	});
	
	// Helper functions for database operations
	const createDb = () => {
		const db = new BetterSqlite3(":memory:");
		return {
			db,
			runGetStatement: (query: string): Promise<unknown> => {
				return Promise.resolve(db.prepare(query).all());
			},
			runMultipleWriteStatements: (query: string): Promise<void> => {
				const transaction = db.transaction(() => {
					db.exec(query);
				});
				transaction();
				return Promise.resolve();
			},
			getTables: () => {
				return Promise.resolve(
					(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Record<string, string>[])
						.map((obj) => obj.name)
				);
			}
		};
	};
	
	test("Rename column", async () => {
		const {db, runGetStatement, runMultipleWriteStatements} = createDb();
		
		// Initial table structure
		const instructions = {
			dialect: "Sqlite",
			tables: {
				users: {
					columns: {
						id: 0,
						username: "",
						email: ""
					},
					tableInfo: {primaryKey: "id"}
				}
			},
			version: 1,
			configPath,
			throwIfNotAllowed: true,
			preMigration(_: PublicMigrations): SqlChanges | void {}
		} satisfies DatabaseInstructions;
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		// Insert test data
		await runMultipleWriteStatements(`
            INSERT INTO users (username, email) VALUES
            ('john_doe', 'john@example.com'),
            ('jane_doe', 'jane@example.com')
        `);
		
		//Check original data:
		expect(await runGetStatement("SELECT * FROM users")).toEqual([
			{id: 1, username: "john_doe", email: "john@example.com"},
			{id: 2, username: "jane_doe", email: "jane@example.com"}
		]);
		
		// Modify table structure
		instructions.version = 2;
		(instructions.tables.users.columns as any).displayName = "";
		delete (instructions.tables.users.columns as any).username;
		
		instructions.preMigration = (migrations: PublicMigrations) => {
			migrations.renameColumn(2, "users", "username", "displayName");
		};
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		//Check for changed structure:
		expect(await runGetStatement("SELECT * FROM users")).toEqual([
			{id: 1, displayName: "john_doe", email: "john@example.com"},
			{id: 2, displayName: "jane_doe", email: "jane@example.com"}
		]);
	});
	
	test("Modify primary key", async () => {
		const {db, runGetStatement, runMultipleWriteStatements} = createDb();
		
		// Initial structure with 'id' as primary key
		const instructions = {
			dialect: "Sqlite",
			tables: {
				products: {
					columns: {
						id: 0,
						sku: "",
						name: ""
					},
					tableInfo: {primaryKey: "id"}
				}
			},
			version: 1,
			configPath,
			throwIfNotAllowed: true,
			alwaysAllowedMigrations: {
				alterPrimaryKey: true,
				recreateTable: true
			}
		} satisfies DatabaseInstructions;
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		// Change primary key to 'sku'
		instructions.version = 2;
		instructions.tables.products.tableInfo.primaryKey = "sku";
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		// Verify the new structure
		const tableInfo = await runGetStatement("PRAGMA table_info(products)");
		const primaryKey = (tableInfo as any[]).find(col => col.pk === 1);
		expect(primaryKey.name).toBe("sku");
	});
	
	test("Add and modify foreign keys", async () => {
		const {db, runGetStatement, runMultipleWriteStatements} = createDb();
		
		// Initial structure with two tables
		const instructions = {
			dialect: "Sqlite",
			tables: {
				categories: {
					columns: {
						id: 0,
						name: ""
					},
					tableInfo: {primaryKey: "id"}
				},
				items: {
					columns: {
						id: 0,
						name: "",
						categoryId: 0
					},
					tableInfo: {
						primaryKey: "id",
						foreignKeys: [
							{
								fromTable: "items",
								fromColumn: "categoryId",
								toTable: "categories",
								toColumn: "id",
								onDelete: "CASCADE",
							}
						]
					}
				}
			},
			version: 1,
			configPath,
			throwIfNotAllowed: true,
			preMigration(_: PublicMigrations): SqlChanges | void {
			}
		} satisfies DatabaseInstructions;
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		// Modify foreign key constraint
		instructions.version = 2;
		instructions.preMigration = (migrations: PublicMigrations) => {
			migrations.allowMigration(2, "items", "alterForeignKey");
			migrations.allowMigration(2, "items", "recreateTable"); //sqlite cannot alter foreign keys
		}
		(instructions.tables.items.tableInfo.foreignKeys![0] as any).onDelete = "SET NULL";
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		const foreignKeys = await runGetStatement("PRAGMA foreign_key_list(items)");
		expect((foreignKeys as any[])[0].on_delete).toBe("SET NULL");
	});
	
	test("Rename table", async () => {
		const {db, runGetStatement, runMultipleWriteStatements} = createDb();
		
		// Initial structure
		const instructions: DatabaseInstructions = {
			dialect: "Sqlite",
			tables: {
				old_tasks: {
					columns: {
						id: 0,
						title: "",
						completed: false
					},
					tableInfo: {primaryKey: "id"}
				}
			},
			version: 1,
			configPath,
			throwIfNotAllowed: true
		};
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		// Insert test data
		await runMultipleWriteStatements(`
            INSERT INTO old_tasks (title, completed) VALUES
            ('Task 1', 0),
            ('Task 2', 1)
        `);
		
		// Rename table
		instructions.version = 2;
		instructions.tables = {
			tasks: {
				columns: {
					id: 0,
					title: "",
					completed: false
				},
				tableInfo: {primaryKey: "id"}
			}
		};
		
		instructions.preMigration = (migrations: PublicMigrations) => {
			migrations.renameTable(2, "old_tasks", "tasks");
		};
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		const result = await runGetStatement("SELECT * FROM tasks");
		expect(result).toEqual([
			{id: 1, title: "Task 1", completed: 0},
			{id: 2, title: "Task 2", completed: 1}
		]);
	});
	
	test("Complex schema changes", async () => {
		const {db, runGetStatement, runMultipleWriteStatements} = createDb();
		
		// Initial complex structure
		const instructions: DatabaseInstructions = {
			dialect: "Sqlite",
			tables: {
				departments: {
					columns: {
						id: 0,
						name: ""
					},
					tableInfo: {primaryKey: "id"}
				},
				employees: {
					columns: {
						id: 0,
						firstName: "",
						lastName: "",
						departmentId: 0,
						managerId: 0
					},
					tableInfo: {
						primaryKey: "id",
						foreignKeys: [
							{
								fromTable: "employees",
								fromColumn: "departmentId",
								toTable: "departments",
								toColumn: "id"
							},
							{
								fromTable: "employees",
								fromColumn: "managerId",
								toTable: "employees",
								toColumn: "id"
							}
						]
					}
				}
			},
			version: 1,
			configPath,
			throwIfNotAllowed: true,
			alwaysAllowedMigrations: {
				alterPrimaryKey: true,
				recreateTable: true,
				alterForeignKey: true
			}
		};
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		// Complex changes: rename columns, add new table, modify foreign keys
		instructions.version = 2;
		instructions.tables = {
			departments: {
				columns: {
					id: 0,
					departmentName: "", // renamed from name
					location: "" // new column
				},
				tableInfo: {primaryKey: "id"}
			},
			employees: {
				columns: {
					id: 0,
					fullName: "", // combined from firstName and lastName
					departmentId: 0,
					supervisorId: 0 // renamed from managerId
				},
				tableInfo: {
					primaryKey: "id",
					foreignKeys: [
						{
							fromTable: "employees",
							fromColumn: "departmentId",
							toTable: "departments",
							toColumn: "id",
							onDelete: "SET NULL" // modified constraint
						},
						{
							fromTable: "employees",
							fromColumn: "supervisorId",
							toTable: "employees",
							toColumn: "id",
							onDelete: "SET NULL"
						}
					]
				}
			},
			employee_history: { // new table
				columns: {
					id: 0,
					employeeId: 0,
					changeDate: "",
					changeType: ""
				},
				tableInfo: {
					primaryKey: "id",
					foreignKeys: [
						{
							fromTable: "tableInfo",
							fromColumn: "employeeId",
							toTable: "employees",
							toColumn: "id",
							onDelete: "CASCADE"
						}
					]
				}
			}
		};
		
		instructions.preMigration = (migrations: PublicMigrations) => {
			migrations.renameColumn(2, "departments", "name", "departmentName");
			migrations.renameColumn(2, "employees", "managerId", "supervisorId");
			migrations.allowMigration(2, "employees", "removeForeignKey");
		};
		
		await prepareAndRunMigration({runGetStatement, runMultipleWriteStatements}, instructions);
		
		// Verify the changes
		const tables = await runGetStatement("SELECT name FROM sqlite_master WHERE type='table'");
		expect(tables).toHaveLength(3);
		
		const departmentColumns = await runGetStatement("PRAGMA table_info(departments)");
		expect(departmentColumns).toHaveLength(3); // id, departmentName, location
		
		const employeeColumns = await runGetStatement("PRAGMA table_info(employees)");
		expect(employeeColumns).toHaveLength(4); // id, fullName, departmentId, supervisorId
	});
});