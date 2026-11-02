import {TableClassInterface, Class} from "./typings/TableClassInterface.ts";
import DatabaseInstructions from "./typings/DatabaseInstructions.ts";
import {TableStructure} from "./typings/TableStructure.ts";
import DefaultSql from "./dialects/DefaultSql.ts";

import {getTableStructure} from "./tableInfo/getTableStructure.ts";
import {InputTableStructure} from "./typings/InputTableStructure.ts";
import {TableObjHelper} from "./tableInfo/TableObjHelper.ts";
import {IndexInfo} from "./typings/IndexInfo.ts";

/**
 * Postgres silently truncates longer identifiers, which would lead to differing index names in each migration
 */
const MAX_INDEX_NAME_LENGTH = 63;

/**
 * Represents a generator for creating table structures based on specified database instructions
 */
export default class TableStructureGenerator {
	private readonly dialect: DefaultSql;
	private readonly dbInstructions: DatabaseInstructions;
	
	constructor(dbInstructions: DatabaseInstructions, dialect: DefaultSql) {
		this.dialect = dialect;
		this.dbInstructions = dbInstructions;
	}
	
	/**
	 * Generates the structure of tables based on database instructions.
	 *
	 * @return An object where keys are table names, and values are their corresponding table structures.
	 */
	public generateTableStructure(): Record<string, TableStructure> {
		const tables: Record<string, TableStructure> = {};
		const indexNames: Record<string, string> = {};
		
		for(const table of this.dbInstructions.tables) {
			let structure: InputTableStructure;
			let tableName: string;
			if(TableObjHelper.isTableObj(table)) {
				structure = table.tableStructure;
				tableName = table.tableName;
			}
			else {
				const classTable = table as Class<TableClassInterface>;
				structure = getTableStructure(classTable);
				tableName = classTable.name;
			}
			//get sql column data
			for(const key in structure.columns) {
				const entry = structure.columns[key];
				entry.defaultValue = entry.inputDefaultValue === null ? this.dialect.nullType : this.dialect.formatValueToSql(entry.inputDefaultValue, entry.inputType!);
				entry.sqlType = this.dialect.getSqlType(entry.inputType!, entry);
			}
			
			const indexes = this.getIndexes(tableName, structure);
			//index names need to be unique in the whole database for most dialects:
			for(const index of indexes) {
				if(indexNames[index.name])
					throw new Error(`Index name "${index.name}" is used in ${indexNames[index.name]} and ${tableName}. Index names need to be unique.`);
				indexNames[index.name] = tableName;
			}
			
			tables[tableName] = {...structure, indexes: indexes};
		}
		
		return tables;
	}
	
	/**
	 * Validates the index definitions of a table and generates names for indexes that have none.
	 *
	 * @param tableName - The name of the table the indexes belong to.
	 * @param structure - The table structure containing the index definitions.
	 * @return The index definitions including their names.
	 */
	private getIndexes(tableName: string, structure: InputTableStructure): IndexInfo[] {
		return (structure.indexes ?? []).map(index => {
			if(!index.columns.length)
				throw new Error(`An index in ${tableName} has no columns.`);
			for(const column of index.columns) {
				if(!structure.columns[column])
					throw new Error(`Index in ${tableName} uses column "${column}", which does not exist.`);
			}
			
			const name = index.name ?? `${tableName}_${index.columns.join("_")}_idx`;
			if(name.length > MAX_INDEX_NAME_LENGTH)
				throw new Error(`Index name "${name}" is longer than ${MAX_INDEX_NAME_LENGTH} characters. Please provide a shorter name.`);
			
			return {name: name, columns: index.columns, isUnique: index.isUnique};
		});
	}
}