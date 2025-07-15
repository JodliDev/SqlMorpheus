import {BackendTable, Class} from "../../typings/BackendTable";
import {getTableInfo, getTableInfoFromMetadata} from "../TableInfo";

export default function DbTable<T extends BackendTable>(tableName: string, primaryKey?: keyof T) {
	return (table: Class<T>, context?: any) => {
		Object.defineProperty(table, "name", {value: tableName, writable: false});
		
		const tableInfo = context?.metadata ? getTableInfoFromMetadata(context.metadata) : getTableInfo(table);
		tableInfo.primaryKey = primaryKey?.toString();
		
		if(tableInfo.foreignKeys) {
			for(const foreignKey of tableInfo.foreignKeys) {
				foreignKey.fromTable = tableName;
			}
		}
	}
}