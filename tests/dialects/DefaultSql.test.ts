import {describe, expect, it, vi} from "vitest";
import DefaultSql from "../../src/lib/dialects/DefaultSql";
import {DatabaseAccess} from "../../src";
import {ColumnInfo} from "../../src/lib/typings/ColumnInfo";
import {DataTypeOptions} from "../../src/lib/tableInfo/DataTypeOptions";

class TestSql extends DefaultSql {
	public override async getColumnInformation(tableName: string): Promise<ColumnInfo[]> {
		return [];
	}
	
	public override async getTableNames(): Promise<string[]> {
		return [];
	}
}

describe("DefaultSql", () => {
	const mockAccess: DatabaseAccess = {
		runGetStatement: vi.fn(),
		runMultipleWriteStatements: vi.fn(),
	};
	const mockDialect = new TestSql(mockAccess);
	
	describe("formatValueToSql", () => {
		it("should format string values correctly", () => {
			const result = mockDialect.formatValueToSql("test", "string");
			expect(result).toBe('"test"');
		});
		
		it("should format date values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20"), "date");
			expect(result).toBe("2025-07-20");
		});
		
		it("should format datetime values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20T15:30:00"), "dateTime");
			expect(result).toBe("2025-07-20 15:30:00");
		});
		
		it("should format time values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20T15:30:00"), "time");
			expect(result).toBe("15:30:00");
		});
		
		it("should default to string conversion for unknown types", () => {
			const result = mockDialect.formatValueToSql(12345, "unknown" as DataTypeOptions);
			expect(result).toBe("12345");
		});
	});
	
	describe("foreignKey", () => {
		it("should create foreign key without actions", () => {
			const result = mockDialect.foreignKey("column", "foreignTable", "foreignColumn");
			expect(result).toBe("FOREIGN KEY (column) REFERENCES foreignTable (foreignColumn)");
		});
		
		it("should create foreign key with ON UPDATE and ON DELETE actions", () => {
			const result = mockDialect.foreignKey("column", "foreignTable", "foreignColumn", "CASCADE", "SET NULL");
			expect(result).toBe("FOREIGN KEY (column) REFERENCES foreignTable (foreignColumn) ON UPDATE CASCADE ON DELETE SET NULL");
		});
	});
	
	describe("createTable", () => {
		it("should create a valid CREATE TABLE query", () => {
			const entries = ["id INTEGER PRIMARY KEY", "name TEXT NOT NULL"];
			const query = mockDialect.createTable("users", entries);
			expect(query).toBe("CREATE TABLE IF NOT EXISTS users  (\n\tid INTEGER PRIMARY KEY,\n\tname TEXT NOT NULL\n);");
		});
	});
	
	describe("columnDefinition", () => {
		it("should create a column definition without primary key", () => {
			const result = mockDialect.columnDefinition("name", "TEXT", "'default'", false);
			expect(result).toBe("name TEXT DEFAULT 'default'");
		});
		
		it("should create a column definition with primary key", () => {
			const result = mockDialect.columnDefinition("id", "INTEGER", "1", true);
			expect(result).toBe("id INTEGER DEFAULT 1 PRIMARY KEY");
		});
	});
	
	describe("dropTable", () => {
		it("should create a valid DROP TABLE query", () => {
			const result = mockDialect.dropTable("users");
			expect(result).toBe("DROP TABLE IF EXISTS users;");
		});
	});
	
	describe("getVersion", () => {
		it("should return the correct version", async() => {
			mockAccess.runGetStatement = vi.fn().mockResolvedValue([{version: 3}]);
			const version = await mockDialect.getVersion();
			expect(version).toBe(3);
		});
		
		it("should return 0 when there is no version info", async() => {
			mockAccess.runGetStatement = vi.fn().mockResolvedValue([]);
			const version = await mockDialect.getVersion();
			expect(version).toBe(0);
		});
	});
	
	describe("setVersion", () => {
		it("should run the correct query to set a version", async() => {
			await mockDialect.setVersion(5);
			expect(mockAccess.runMultipleWriteStatements).toHaveBeenCalledWith(expect.stringContaining("version = 5"));
		});
	});
});