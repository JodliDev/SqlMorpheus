import {describe, expect, it} from 'vitest';
import {getTableInfo, getTableInfoFromMetadata, TABLE_INFO_PROPERTY_NAME} from "../../src/lib/tableInfo/TableInfo";
import {Class} from "../../src/lib/typings/BackendTable";
import "polyfill-symbol-metadata";

interface BackendTable {
	[key: symbol]: any;
	
	prototype?: any;
}

describe("getTableInfo()", () => {
	it("should return metadata from Symbol.metadata if it exists on the table", () => {
		const metadata = {primaryKey: "id"};
		const mockTable = {[Symbol.metadata]: {[TABLE_INFO_PROPERTY_NAME]: metadata}} as unknown as Class<BackendTable>;
		
		const result = getTableInfo(mockTable);
		
		expect(result).toEqual(metadata);
	});
	
	it("should return metadata from prototype[Symbol.metadata] if Symbol.metadata exists on the prototype", () => {
		const metadata = {primaryKey: "id"};
		const mockTable = {[Symbol.metadata]: {[TABLE_INFO_PROPERTY_NAME]: metadata}} as unknown as Class<BackendTable>;
		
		const result = getTableInfo(mockTable);
		
		expect(result).toEqual(metadata);
	});
	
	it("should create an empty metadata object if none exists and assign it to Symbol.metadata", () => {
		const mockTable = {} as unknown as Class<BackendTable>;
		
		const result = getTableInfo(mockTable);
		
		const expectedMetadata = {primaryKey: "", foreignKeys: []};
		expect(result).toEqual(expectedMetadata);
		expect(mockTable[Symbol.metadata]).toEqual({[TABLE_INFO_PROPERTY_NAME]: expectedMetadata});
	});
	
	it("should handle scenarios where prototype is undefined", () => {
		const mockTable = {prototype: undefined} as unknown as Class<BackendTable>;
		
		const result = getTableInfo(mockTable);
		
		const expectedMetadata = {primaryKey: "", foreignKeys: []};
		expect(result).toEqual(expectedMetadata);
		expect(mockTable[Symbol.metadata]).toEqual({[TABLE_INFO_PROPERTY_NAME]:expectedMetadata});
	});
});

describe("getTableInfoFromMetadata()", () => {
	it("should initialize missing TABLE_INFO_PROPERTY_NAME with default values", () => {
		const metadata: Record<PropertyKey, unknown> = {};
		
		const result = getTableInfoFromMetadata(metadata);
		
		expect(result).toEqual({primaryKey: "", foreignKeys: []});
	});
	
	it("should return existing TABLE_INFO_PROPERTY_NAME if already initialized", () => {
		const existingMetadata = {primaryKey: "id", foreignKeys: [{column: "fk1", references: "table2.pk"}]};
		const metadata: Record<PropertyKey, unknown> = {[TABLE_INFO_PROPERTY_NAME]: existingMetadata};
		
		const result = getTableInfoFromMetadata(metadata);
		
		expect(result).toEqual(existingMetadata);
	});
	
	it("should modify the original metadata object when default metadata is added", () => {
		const metadata: Record<PropertyKey, unknown> = {};
		
		const result = getTableInfoFromMetadata(metadata);
		
		expect(result).toEqual(metadata[TABLE_INFO_PROPERTY_NAME]);
	});
});