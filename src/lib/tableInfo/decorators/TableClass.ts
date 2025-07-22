import {TableClassInterface, Class} from "../../typings/TableClassInterface";
import {getTableInfo, getTableInfoFromMetadata} from "../TableInfo";
import "polyfill-symbol-metadata"; //Temporary fix. See https://github.com/daomtthuan/polyfill-symbol-metadata#readme

/**
 * Decorator function to configure a database table with its name and primary key.
 *
 * @param tableName - The name of the database table used in SQL.
 * @param primaryKey - The property name representing the primary property of the table.
 */
export default function TableClass<T extends TableClassInterface>(tableName: string, primaryKey?: keyof T) {
	return (table: Class<T>, context?: any) => {
		const tableInfo = context?.metadata ? getTableInfoFromMetadata(context.metadata) : getTableInfo(table);
		tableInfo.primaryKey = primaryKey?.toString();
		
		if(tableInfo.foreignKeys) {
			for(const foreignKey of tableInfo.foreignKeys) {
				foreignKey.fromTable = tableName;
				if(foreignKey.toTable == table.name)
					foreignKey.toTable = tableName;
			}
		}
		
		Object.defineProperty(table, "name", {value: tableName, writable: false});
	}
}