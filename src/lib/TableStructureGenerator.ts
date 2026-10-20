import {TableClassInterface, Class} from "./typings/TableClassInterface.ts";
import DatabaseInstructions from "./typings/DatabaseInstructions.ts";
import {TableStructure} from "./typings/TableStructure.ts";
import DefaultSql from "./dialects/DefaultSql.ts";

import {getTableStructure} from "./tableInfo/getTableStructure.ts";
import {InputTableStructure} from "./typings/InputTableStructure.ts";
import {TableObjHelper} from "./tableInfo/TableObjHelper.ts";

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
		
		for(const table of this.dbInstructions.tables) {
			let structure: InputTableStructure;
			if(TableObjHelper.isTableObj(table)) {
				structure = table.tableStructure;
				tables[table.tableName] = table.tableStructure;
			}
			else {
				const classTable = table as Class<TableClassInterface>;
				structure = getTableStructure(classTable);
				tables[classTable.name] = structure;
				
			}
			//get sql column data
			for(const key in structure.columns) {
				const entry = structure.columns[key];
				entry.defaultValue = entry.inputDefaultValue === null ? this.dialect.nullType : this.dialect.formatValueToSql(entry.inputDefaultValue, entry.inputType!);
				entry.sqlType = this.dialect.getSqlType(entry.inputType!, entry);
			}
		}
		
		return tables;
	}
}