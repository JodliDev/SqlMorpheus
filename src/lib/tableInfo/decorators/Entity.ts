import {BackendTable, Class} from "../../typings/BackendTable.ts";
import {getTableInfo} from "../TableInfo.ts";

export default function Entity<T extends BackendTable>(tableName: string, primaryKey?: keyof T) {
	return (table: Class<T>) => {
		Object.defineProperty(table, "name", {value: tableName, writable: false});
		
		const tableInfo = getTableInfo(table);
		tableInfo.primaryKey = primaryKey?.toString();
	}
}