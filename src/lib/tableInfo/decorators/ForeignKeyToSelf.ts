import {TableClassInterface, Class} from "../../typings/TableClassInterface";
import {getTableInfo, getTableInfoFromMetadata} from "../TableInfo";
import "polyfill-symbol-metadata"; //Temporary fix. See https://github.com/daomtthuan/polyfill-symbol-metadata#readme
import {ForeignKeyActions} from "../../typings/ForeignKeyInfo";

/**
 * Decorator function to define a self-referencing foreign key relationship within a table.
 * This decorator must be used at the head of the class.
 *
 * @param fromColumn - The column in the table that acts as the foreign key reference.
 * @param toColumn - The target column within the same table being referenced by the foreign key.
 * @param options - Additional options.
 */
export default function ForeignKeyToSelf<T extends TableClassInterface>(
	fromColumn: keyof T,
	toColumn: keyof T,
	options?: {
		onUpdate?: ForeignKeyActions,
		onDelete?: ForeignKeyActions,
	},
) {
	return (table: Class<T>, context?: any) => {
		const tableInfo = context?.metadata ? getTableInfoFromMetadata(context.metadata) : getTableInfo(table);
		if(!tableInfo.foreignKeys)
			tableInfo.foreignKeys = [];
		
		tableInfo.foreignKeys.push({
			fromTable: table.name,
			fromColumn: fromColumn.toString(),
			toTable: table.name,
			toColumn: toColumn.toString(),
			onDelete: options?.onDelete,
			onUpdate: options?.onUpdate,
		});
	}
}