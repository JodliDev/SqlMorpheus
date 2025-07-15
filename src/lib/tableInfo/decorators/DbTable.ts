import {BackendTable, Class} from "../../typings/BackendTable";
import {getTableInfoFromMetadata} from "../TableInfo";

export default function DbTable<T extends BackendTable>(tableName: string, primaryKey?: keyof T) {
	return (table: Class<T>, context: any) => {
		Object.defineProperty(table, "name", {value: tableName, writable: false});
		
		const tableInfo = getTableInfoFromMetadata(context.metadata);
		tableInfo.primaryKey = primaryKey?.toString();
		
		if(tableInfo.foreignKeys) {
			for(const foreignKey of tableInfo.foreignKeys) {
				foreignKey.fromTable = tableName;
			}
		}
	}
}