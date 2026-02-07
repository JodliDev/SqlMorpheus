```typescript
import {DatabaseAccess, runMigration} from "sqlmorpheus";

const usersTable = TableObj.create("User", {
	userId: [0, {primaryKey: true}],
	name: "Default name",
	email: [null, {dataType: "string"}]
});

const messagesTable = TableObj.create("Message", {
	messageId: [0, {primaryKey: true}],
	from: 0,
	to: 0,
    content: ""
})
	.foreignKey("from", usersTable, "userId", {onDelete: "CASCADE"})
	.foreignKey("to", usersTable, "userId", {onDelete: "CASCADE"});
```