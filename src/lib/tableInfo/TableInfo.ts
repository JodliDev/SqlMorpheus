import {ForeignKeyInfo} from "../typings/ForeignKeyInfo";
import {BackendTable, Class} from "../typings/BackendTable";

export const TABLE_INFO_PROPERTY_NAME = Symbol("tableInfo");

export default interface TableInfo {
	primaryKey?: string;
	foreignKeys?: ForeignKeyInfo[];
}

/**
 * Retrieves table information based on the provided class and their decorators.
 * If the table metadata property does not exist in the metadata,
 * it initializes a default structure.
 *
 * @param table - The class representing the table.
 * @return The table information as a `TableInfo` object.
 */
export function getTableInfo<T extends BackendTable>(table: Class<T>): TableInfo {
	//to stay compatible with old decorator structure (see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#decorator-metadata):
	let metadata = table[Symbol.metadata] ?? table.prototype?.[Symbol.metadata];
	
	if(!metadata) {
		metadata = {};
		table[Symbol.metadata] = metadata;
	}
	return getTableInfoFromMetadata(metadata);
}

/**
 * Extracts and returns table information from the provided metadata object.
 * If the specified table information property does not exist in the metadata,
 * it initializes a default structure.
 *
 * @param metadata - The metadata object which potentially contains table information.
 * @return {TableInfo} The table information retrieved or initialized from the metadata.
 */
export function getTableInfoFromMetadata(metadata: Record<PropertyKey, unknown>): TableInfo {
	if(!metadata[TABLE_INFO_PROPERTY_NAME])
		metadata[TABLE_INFO_PROPERTY_NAME] = {primaryKey: "", foreignKeys: []} satisfies TableInfo;
	
	return metadata[TABLE_INFO_PROPERTY_NAME]!;
}