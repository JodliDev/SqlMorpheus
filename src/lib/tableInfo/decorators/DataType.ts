import "polyfill-symbol-metadata"; //Temporary fix. See https://github.com/daomtthuan/polyfill-symbol-metadata#readme
import {DataTypeOptions} from "../DataTypeOptions";

import {getInputColumnInfo} from "../getTableStructure";

/**
 * Decorator function to assign a specific data type to a column.
 * Should be used if you want to use a data type that does not exist in JavaScript or
 * if the default value should be NULL
 *
 * @param type - The data type to be assigned.
 */
export default function DataType(
	type: DataTypeOptions
) {
	return (table: any, context: any) => {
		const entry = getInputColumnInfo(table, context);
		entry.inputType = type;
	}
}