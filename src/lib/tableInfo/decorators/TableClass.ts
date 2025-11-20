import {Class, TableClassInterface} from "../../typings/TableClassInterface";
import "polyfill-symbol-metadata";
import {getTableStructure, getTableStructureFromMetadata} from "../getTableStructure";
import {TableObjHelper} from "../TableObjHelper"; //Temporary fix. See https://github.com/daomtthuan/polyfill-symbol-metadata#readme

/**
 * Decorator function to configure a database table with its name and primary key.
 *
 * @param tableName - The name of the database table used in SQL.
 * @param primaryKey - The property name representing the primary property of the table.
 */
export default function TableClass<T extends TableClassInterface>(tableName: string, primaryKey?: keyof T) {
	return (table: Class<T>, context?: any) => {
		const tableStructure = context?.metadata ? getTableStructureFromMetadata(context.metadata) : getTableStructure(table);
		tableStructure.primaryKey = primaryKey?.toString();
		tableStructure.table = tableName;
		
		//fix foreignKeys:
		if(tableStructure.foreignKeys) {
			for(const foreignKey of tableStructure.foreignKeys) {
				foreignKey.fromTable = tableName;
				if(foreignKey.toTable == table.name)
					foreignKey.toTable = tableName;
			}
		}
		
		const obj = new table;
		//fill missing entries:
		for(const key in obj) {
			const value = obj[key as keyof Class<T>];
			const existingEntry = tableStructure.columns[key];
			const defaultEntry = TableObjHelper.getColumnEntry(key, value);
			if(!defaultEntry)
				continue;
			if(key == primaryKey)
				defaultEntry.isPrimaryKey = true;
			tableStructure.columns[key] = {
				...defaultEntry,
				...existingEntry
			};
		}
		
		Object.defineProperty(table, "name", {value: tableName, writable: false});
	}
}

