import {describe, expect, it, vi} from "vitest";
import DefaultSql from "../../src/lib/dialects/DefaultSql";
import {DatabaseAccess} from "../../src";
import {ColumnInfo} from "../../src/lib/typings/ColumnInfo";
import {DataTypeOptions} from "../../src/lib/tableInfo/DataTypeOptions";
import { ForeignKeyInfo } from "../../src/lib/typings/ForeignKeyInfo";

class TestSql extends DefaultSql {
    public runTransactionWithoutForeignKeys(): Promise<void> {
        throw new Error("runTransactionWithoutForeignKeys() is not implemented.");
    }
	public getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
		throw new Error("getForeignKeys() is not implemented.");
	}
	public override async getColumnInformation(tableName: string): Promise<Record<string, ColumnInfo>> {
		return {};
	}
	
	public override async getTableNames(): Promise<string[]> {
		return [];
	}
}

describe("DefaultSql", () => {
	const mockAccess: DatabaseAccess = {
		runReadStatement: vi.fn(),
		runWriteStatement: vi.fn(),
		runTransaction: vi.fn(),
	};
	const mockDialect = new TestSql(mockAccess);
	
	describe("formatValueToSql", () => {
		it("should format string values correctly", () => {
			const result = mockDialect.formatValueToSql("test", "string");
			expect(result).toBe("'test'");
		});
		
		it("should format date values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20"), "date");
			expect(result).toBe("'2025-07-20'");
		});
		
		it("should format datetime values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20T15:30:00.000Z"), "dateTime");
			expect(result).toBe("'2025-07-20 15:30:00'");
		});
		
		it("should format time values correctly", () => {
			const result = mockDialect.formatValueToSql(new Date("2025-07-20T15:30:00.000Z"), "time");
			expect(result).toBe("'15:30:00'");
		});
		
		it("should default to string conversion for unknown types", () => {
			const result = mockDialect.formatValueToSql(12345, "unknown" as DataTypeOptions);
			expect(result).toBe("12345");
		});
	});
});