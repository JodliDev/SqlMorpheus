```typescript
import {TableClass, ForeignKey} from "sqlmorpheus";

@TableClass("User", "userId")
class UserTable {
	userId: number = 0;
	
	name: string = "Default name";
	
	@DataType("string")
	email: string | null = null;
}

@TableClass("Message", "messageId")
class MessageTable {
	messageId: number = 0;
	
	@ForeignKey(UserTable, "userId", {onDelete: "CASCADE"})
	from: number = 0;
	
	@ForeignKey(UserTable, "userId", {onDelete: "CASCADE"})
	to: number = 0;
	
	content: string = "";
}

```