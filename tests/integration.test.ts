// noinspection SqlResolve

import {describe, expect, beforeEach, it} from "vitest";
import DatabaseInstructions, {TableInput} from "../src/lib/typings/DatabaseInstructions";
import {runMigration, PublicMigrations, SqlChanges} from "../src";
import TableObj from "../src/lib/tableInfo/TableObj";
import {SqliteDatabaseAccess} from "./dialects/SqliteDatabaseAccess";

describe("Integration tests", () => {
	const configPath = `${process.cwd()}/config/`;
	let access: SqliteDatabaseAccess;
	
	beforeEach(() => {
		access = new SqliteDatabaseAccess();
	});
	
	
	it("should rename a column", async () => {
		const users = TableObj.create("Users", {
			id: [0, {primaryKey: true}],
			username: "",
			email: ""
		});
		
		// Initial table structure
		const instructions = {
			dialect: "Sqlite",
			tables: [users] as TableInput[],
			version: 1,
			configPath,
			throwIfNotAllowed: true,
			preMigration(_: PublicMigrations): SqlChanges | void {}
		} satisfies DatabaseInstructions;
		
		await runMigration(access, instructions);
		
		// Insert test data
		await access.runTransaction(`
            INSERT INTO users (username, email) VALUES
            ('john_doe', 'john@example.com'),
            ('jane_doe', 'jane@example.com')
        `);
		
		//Check original data:
		expect(await access.runReadStatement("SELECT * FROM users")).toEqual([
			{id: 1, username: "john_doe", email: "john@example.com"},
			{id: 2, username: "jane_doe", email: "jane@example.com"}
		]);
		
		// Modify table structure
		instructions.version = 2;
		(users as TableObj<any>).tableStructure.columns.displayName = (users as TableObj<any>).tableStructure.columns.username;
		delete (users as TableObj<any>).tableStructure.columns.username;
		
		instructions.preMigration = (migrations: PublicMigrations) => {
			migrations.renameColumn(2, "Users", "username", "displayName");
		};
		
		await runMigration(access, instructions);
		
		//Check for changed structure:
		expect(await access.runReadStatement("SELECT * FROM users")).toEqual([
			{id: 1, displayName: "john_doe", email: "john@example.com"},
			{id: 2, displayName: "jane_doe", email: "jane@example.com"}
		]);
	});
	
	it("should modify primary key", async () => {
		const products = TableObj.create("Products", {
			id: [0, {primaryKey: true}],
			sku: "",
			name: ""
		});
		
		// Initial structure with 'id' as primary key
		const instructions = {
			dialect: "Sqlite",
			tables: [products],
			version: 1,
			configPath,
			throwIfNotAllowed: true,
			alwaysAllowedMigrations: ["alterPrimaryKey", "recreateTable"]
		} satisfies DatabaseInstructions;
		
		await runMigration(access, instructions);
		
		// Change primary key to 'sku'
		instructions.version = 2;
		instructions.tables = [TableObj.create("Products", {
			id: 0,
			sku: ["", {primaryKey: true}],
			name: ""
		})];
		
		await runMigration(access, instructions);
		
		// Verify the new structure
		const tableInfo = await access.runReadStatement("PRAGMA table_info(products)");
		const primaryKey = (tableInfo as any[]).find(col => col.pk === 1);
		expect(primaryKey.name).toBe("sku");
	});
	
	describe("foreign key tests", () => {
		it("should add and modify foreign keys", async () => {
			const categories = TableObj.create("Categories", {
				id: [0, {primaryKey: true}],
				name: ""
			});
			
			const items = TableObj.create("Items", {
				id: [0, {primaryKey: true}],
				name: "",
				categoryId: 0
			})
				.foreignKey("categoryId", categories, "id", {onDelete: "CASCADE"});
			
			// Initial structure with two tables
			const instructions = {
				dialect: "Sqlite",
				tables: [categories, items],
				version: 1,
				configPath,
				throwIfNotAllowed: true,
				preMigration(_: PublicMigrations): SqlChanges | void {}
			} satisfies DatabaseInstructions;
			
			await runMigration(access, instructions);
			
			// Modify foreign key constraint
			instructions.version = 2;
			instructions.preMigration = (migrations: PublicMigrations) => {
				migrations.allowMigration(2, "Items", "alterForeignKey", "categoryId");
				migrations.allowMigration(2, "Items", "recreateTable"); //sqlite cannot alter foreign keys
			}
			(items as TableObj<any>).tableStructure.foreignKeys![0].onDelete = "SET NULL";
			
			await runMigration(access, instructions);
			
			const foreignKeys = await access.runReadStatement("PRAGMA foreign_key_list(items)") as any[];
			expect(foreignKeys[0].on_delete).toBe("SET NULL");
		});
	});
	
	
	it("should rename a table", async () => {
		const oldTasks = TableObj.create("old_tasks", {
			id: [0, {primaryKey: true}],
			title: "",
			completed: false
		});
		
		const tasks = TableObj.create("tasks", {
			id: [0, {primaryKey: true}],
			title: "",
			completed: false
		});
		
		// Initial structure
		const instructions: DatabaseInstructions = {
			dialect: "Sqlite",
			tables: [oldTasks],
			version: 1,
			configPath,
			throwIfNotAllowed: true
		};
		
		await runMigration(access, instructions);
		
		// Insert test data
		await access.runTransaction(`
            INSERT INTO old_tasks (title, completed) VALUES
            ('Task 1', 0),
            ('Task 2', 1)
        `);
		
		// Rename table
		instructions.version = 2;
		instructions.tables = [tasks];
		
		instructions.preMigration = (migrations: PublicMigrations) => {
			migrations.renameTable(2, "old_tasks", "tasks");
		};
		
		await runMigration(access, instructions);
		
		const result = await access.runReadStatement("SELECT * FROM tasks");
		expect(result).toEqual([
			{id: 1, title: "Task 1", completed: 0},
			{id: 2, title: "Task 2", completed: 1}
		]);
	});
	
	it("should do complex schema changes", async () => {
		const departments = TableObj.create("departments", {
			id: [0, {primaryKey: true}],
			name: ""
		});
		
		const employees = TableObj.create("employees", {
			id: [0, {primaryKey: true}],
			firstName: "",
			lastName: "",
			departmentId: 0,
			managerId: 0
		})
			.foreignKey("departmentId", departments, "id", {onDelete: "CASCADE"});
		employees.foreignKey("managerId", employees, "id");
		
		// Initial complex structure
		const instructions: DatabaseInstructions = {
			dialect: "Sqlite",
			tables: [departments, employees],
			version: 1,
			configPath,
			throwIfNotAllowed: true,
			alwaysAllowedMigrations: ["alterPrimaryKey", "recreateTable", "alterForeignKey"]
		};
		
		await runMigration(access, instructions);
		
		
		// Complex changes: rename columns, add new table, modify foreign keys
		
		instructions.tables = [
			TableObj.create("departments", {
				id: [0, {primaryKey: true}],
				// name: "",
				location: "", // added
				departmentName: "" // renamed
			}),
			
			TableObj.create("NewEmployees", {
				id: [0, {primaryKey: true}],
				name: "",
				// firstName: "",
				// lastName: "",
				supervisorId: 0,
				departmentId: 0,
				// managerId: 0
			})
				.foreignKey("departmentId", departments, "id", {onDelete: "SET NULL"}), // modified onDelete
			
			// added table:
			TableObj.create("employees_history", {
				id: [0, {primaryKey: true}],
				employeeId: 0,
				changeDate: "",
				changeType: ""
			})
				.foreignKey("employeeId", employees, "id", {onDelete: "CASCADE"})
		] as any;
		
		instructions.version = 3;
		
		instructions.preMigration = (migrations: PublicMigrations) => {
			migrations.renameColumn(2, "departments", "name", "departmentName");
			migrations.renameColumn(2, "employees", "managerId", "supervisorId");
			migrations.renameTable(2, "employees", "NewEmployees");
			migrations.allowMigration(3, "NewEmployees", "removeForeignKey", "managerId");
		};
		
		await runMigration(access, instructions);
		
		// Verify the changes
		const tables = await access.runReadStatement("SELECT name FROM sqlite_master WHERE type='table'");
		expect(tables).toHaveLength(4); //3 + 1 for the history table
		
		const departmentColumns = await access.runReadStatement("PRAGMA table_info(departments)");
		expect(departmentColumns).toHaveLength(2); // id, departmentName, location
		
		const oldEmployeeColumns = await access.runReadStatement("PRAGMA table_info(employees)");
		expect(oldEmployeeColumns).toHaveLength(0); // should not exist any more
		
		const employeeColumns = await access.runReadStatement("PRAGMA table_info(NewEmployees)");
		expect(employeeColumns).toHaveLength(4); // id, fullName, departmentId, supervisorId
	});
});