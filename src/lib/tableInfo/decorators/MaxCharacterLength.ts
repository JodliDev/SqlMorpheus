import "polyfill-symbol-metadata"; //Temporary fix. See https://github.com/daomtthuan/polyfill-symbol-metadata#readme

import {getInputColumnInfo} from "../getTableStructure";

/**
 * Decorator function to assign a max character length to a column.
 * Will only affect datatypes that can have a max length (e.g., VARCHAR)
 *
 * @param max - The max character length to be defined.
 */
export default function MaxCharacterLength(
	max: number
) {
	return (table: any, context: any) => {
		const entry = getInputColumnInfo(table, context);
		entry.maxLength = max;
	}
}