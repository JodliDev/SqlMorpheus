import {BackendTable, Class} from "../../typings/BackendTable";
import {getTableInfo, getTableInfoFromMetadata} from "../TableInfo";
import "polyfill-symbol-metadata";
import {ForeignKeyActions} from "../../typings/ForeignKeyInfo"; //Temporary fix. See https://github.com/daomtthuan/polyfill-symbol-metadata#readme

/**
 * Decorator function to define a foreign key constraint for a database table. It defines a relationship
 * between a column on the current table and a column on another table.
 *
 * @param toTable - The target table class to which the foreign key points.
 * @param toColumn - The column name in the target table to which the foreign key points.
 * @param [onDelete] - Optional. The action to perform when a row in the target table is deleted.
 * @param [onUpdate] - Optional. The action to perform when a related row in the target table is updated.
 */
export default function ForeignKey<
	TOther extends BackendTable
>(
	toTable: Class<TOther>,
	toColumn: keyof TOther,
	onDelete?: ForeignKeyActions,
	onUpdate?: ForeignKeyActions,
) {
	return (table: any, context: any) => {
		
		const metadata = context?.metadata ? getTableInfoFromMetadata(context.metadata) : getTableInfo(table);
		if(!metadata.foreignKeys)
			metadata.foreignKeys = [];
		
		metadata.foreignKeys.push({
			fromTable: "",
			fromColumn: context.name ?? context, //to stay compatible with old decorator structure (see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#decorator-metadata)
			toTable: toTable.name,
			toColumn: toColumn.toString(),
			onDelete: onDelete,
			onUpdate: onUpdate,
		});
	}
}