import {InputColumnInfo} from "../typings/InputColumnInfo";
import {InputTableStructure} from "../typings/InputTableStructure";
import {TableStructure} from "../typings/TableStructure";
import {Class, TableClassInterface} from "../typings/TableClassInterface";
import {TableObjHelper} from "./TableObjHelper";

export const TABLE_INFO_PROPERTY_NAME = Symbol("tableInfo");

export function getInputColumnInfo(table: any, context: any): InputColumnInfo {
	const metadata = context?.metadata ? getTableStructureFromMetadata(context.metadata) : getTableStructure(table);
	const key = context.name ?? context;
	if(!metadata.columns.hasOwnProperty(key))
		metadata.columns[key] = TableObjHelper.getEmptyColumnEntry(key);
	
	return metadata.columns[key];
}

/**
 * Retrieves table information based on the provided class and their decorators.
 * If the table metadata property does not exist in the metadata,
 * it initializes a default structure.
 *
 * @param table - The class representing the table.
 * @return The table information as a `TableInfo` object.
 */
export function getTableStructure<T extends TableClassInterface>(table: Class<T>): InputTableStructure {
	//to stay compatible with old decorator structure (see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#decorator-metadata):
	let metadata = table[Symbol.metadata] ?? table.prototype?.[Symbol.metadata];
	
	if(!metadata) {
		metadata = {};
		table[Symbol.metadata] = metadata;
	}
	return getTableStructureFromMetadata(metadata);
}

/**
 * Extracts and returns table information from the provided metadata object.
 * If the specified table information property does not exist in the metadata,
 * it initializes a default structure.
 *
 * @param metadata - The metadata object which potentially contains table information.
 * @return {InputTableStructure} The table information retrieved or initialized from the metadata.
 */
export function getTableStructureFromMetadata(metadata: Record<PropertyKey, unknown>): InputTableStructure {
	if(!metadata[TABLE_INFO_PROPERTY_NAME])
		metadata[TABLE_INFO_PROPERTY_NAME] = {table: "", primaryKey: "", foreignKeys: [], columns: {}} satisfies TableStructure;
	
	return metadata[TABLE_INFO_PROPERTY_NAME] as InputTableStructure;
}