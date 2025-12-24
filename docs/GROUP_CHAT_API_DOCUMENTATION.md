# Group Chat API Documentation

## Overview

The Group Chat API enables WhatsApp-like group messaging functionality. Users can create groups, add/remove members, manage admin roles, and exchange messages within groups. All operations are based on wallet addresses for user identification.

**Base URL:** `/api/v1/group-chat`

---

## Authentication

All endpoints are **PUBLIC** (no JWT authentication required). Users are identified by their XRPL wallet address passed in request parameters or body.

---

## Response Format

All API responses follow this standard format:

```json
{
  "statusCode": 200,
  "data": { ... },
  "message": "Success message",
  "success": true
}
```

### Pagination Format

Paginated endpoints return:

```json
{
  "statusCode": 200,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "message": "Success",
  "success": true
}
```

---

## Group Management

### Create Group

**POST** `/group-chat`

Create a new group chat. The creator automatically becomes an admin.

**Request Body:**
```json
{
  "creatorWalletAddress": "rCreatorWalletAddress",
  "name": "My Cool Group",
  "description": "A group for NFT enthusiasts",
  "groupImage": "https://example.com/group-image.jpg",
  "memberWalletAddresses": [
    "rMember1WalletAddress",
    "rMember2WalletAddress"
  ]
}
```

**Fields:**
- `creatorWalletAddress` (required): Creator's XRPL wallet address
- `name` (required): Group name (max 100 characters)
- `description` (optional): Group description
- `groupImage` (optional): URL to group profile image
- `memberWalletAddresses` (optional): Array of wallet addresses to add as initial members

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Group created successfully",
  "data": {
    "group": {
      "id": "uuid",
      "name": "My Cool Group",
      "description": "A group for NFT enthusiasts",
      "groupImage": "https://example.com/group-image.jpg",
      "creatorWalletAddress": "rCreatorWalletAddress",
      "creator": {
        "walletAddress": "rCreatorWalletAddress",
        "username": "creator_name",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true
      },
      "memberCount": 3,
      "lastMessageAt": null,
      "lastMessagePreview": null,
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "members": [
        {
          "walletAddress": "rCreatorWalletAddress",
          "username": "creator_name",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true,
          "role": "admin",
          "joinedAt": "2025-01-15T10:30:00.000Z"
        },
        {
          "walletAddress": "rMember1WalletAddress",
          "username": "member1",
          "profileImage": null,
          "isVerified": false,
          "role": "member",
          "joinedAt": "2025-01-15T10:30:00.000Z"
        }
      ]
    }
  }
}
```

**Notes:**
- Creator is automatically added as admin
- A system message is created announcing group creation
- Members who don't exist are auto-created

---

### Get User's Groups

**GET** `/group-chat/groups/:walletAddress?page=1&limit=20`

Get all groups where the user is a member.

**Parameters:**
- `walletAddress` (path parameter): User's XRPL wallet address

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Groups per page (default: 20)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Groups retrieved successfully",
  "data": {
    "groups": [
      {
        "id": "uuid",
        "name": "NFT Collectors",
        "description": "A group for NFT collectors",
        "groupImage": "https://example.com/group.jpg",
        "creatorWalletAddress": "rCreatorWallet",
        "creator": {
          "walletAddress": "rCreatorWallet",
          "username": "creator",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true
        },
        "memberCount": 15,
        "lastMessageAt": "2025-01-15T10:30:00.000Z",
        "lastMessagePreview": "Check out this new NFT!",
        "lastMessageSenderWallet": "rSenderWallet",
        "isActive": true,
        "myRole": "admin",
        "unreadCount": 5
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

**Notes:**
- Groups sorted by last message timestamp (most recent first)
- `myRole` indicates user's role in the group (admin/member)
- `unreadCount` shows messages since user's last read

---

### Get Group Details

**GET** `/group-chat/:groupId/details/:walletAddress`

Get detailed information about a specific group.

**Parameters:**
- `groupId` (path parameter): Group UUID
- `walletAddress` (path parameter): Requesting user's wallet address

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Group details retrieved successfully",
  "data": {
    "group": {
      "id": "uuid",
      "name": "NFT Collectors",
      "description": "A group for NFT collectors",
      "groupImage": "https://example.com/group.jpg",
      "creatorWalletAddress": "rCreatorWallet",
      "creator": {
        "walletAddress": "rCreatorWallet",
        "username": "creator",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true
      },
      "memberCount": 15,
      "lastMessageAt": "2025-01-15T10:30:00.000Z",
      "myRole": "admin",
      "members": [
        {
          "walletAddress": "rCreatorWallet",
          "username": "creator",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true,
          "role": "admin",
          "joinedAt": "2025-01-01T00:00:00.000Z"
        },
        {
          "walletAddress": "rMemberWallet",
          "username": "member",
          "profileImage": null,
          "isVerified": false,
          "role": "member",
          "joinedAt": "2025-01-10T00:00:00.000Z"
        }
      ]
    }
  }
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "You are not a member of this group"
}
```

---

### Update Group

**PUT** `/group-chat/:groupId`

Update group details. Only admins can update group information.

**Parameters:**
- `groupId` (path parameter): Group UUID

**Request Body:**
```json
{
  "walletAddress": "rAdminWalletAddress",
  "name": "Updated Group Name",
  "description": "Updated description",
  "groupImage": "https://example.com/new-image.jpg"
}
```

**Fields:**
- `walletAddress` (required): Admin's wallet address
- `name` (optional): New group name
- `description` (optional): New group description
- `groupImage` (optional): New group image URL

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Group updated successfully",
  "data": {
    "group": {
      "id": "uuid",
      "name": "Updated Group Name",
      "description": "Updated description",
      "groupImage": "https://example.com/new-image.jpg"
    }
  }
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "Only admins can update group details"
}
```

---

### Delete Group

**DELETE** `/group-chat/:groupId`

Delete (deactivate) a group. Only the group creator can delete the group.

**Parameters:**
- `groupId` (path parameter): Group UUID

**Request Body:**
```json
{
  "walletAddress": "rCreatorWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Group deleted successfully",
  "data": null
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "Only the group creator can delete the group"
}
```

**Notes:**
- Deletion is a soft-delete (sets `isActive` to false)
- All member memberships are also deactivated

---

## Member Management

### Add Members

**POST** `/group-chat/:groupId/members`

Add new members to the group. Only admins can add members.

**Parameters:**
- `groupId` (path parameter): Group UUID

**Request Body:**
```json
{
  "walletAddress": "rAdminWalletAddress",
  "memberWalletAddresses": [
    "rNewMember1WalletAddress",
    "rNewMember2WalletAddress"
  ]
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Members added successfully",
  "data": {
    "addedMembers": [
      "rNewMember1WalletAddress",
      "rNewMember2WalletAddress"
    ],
    "memberCount": 17
  }
}
```

**Notes:**
- System messages are created for each member added
- Users who don't exist are auto-created
- Previously removed members can be re-added

---

### Remove Member

**DELETE** `/group-chat/:groupId/members`

Remove a member from the group. Only admins can remove members.

**Parameters:**
- `groupId` (path parameter): Group UUID

**Request Body:**
```json
{
  "walletAddress": "rAdminWalletAddress",
  "memberWalletAddress": "rMemberToRemoveWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Member removed successfully",
  "data": {
    "removedMember": "rMemberToRemoveWalletAddress",
    "memberCount": 14
  }
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "Cannot remove the group creator"
}
```

---

### Leave Group

**POST** `/group-chat/:groupId/leave`

Leave a group. The group creator cannot leave (must delete the group instead).

**Parameters:**
- `groupId` (path parameter): Group UUID

**Request Body:**
```json
{
  "walletAddress": "rMemberWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Left the group successfully",
  "data": null
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "Group creator cannot leave. Delete the group instead."
}
```

---

### Get Group Members

**GET** `/group-chat/:groupId/members/:walletAddress`

Get all members of a group.

**Parameters:**
- `groupId` (path parameter): Group UUID
- `walletAddress` (path parameter): Requesting user's wallet address

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Members retrieved successfully",
  "data": {
    "members": [
      {
        "walletAddress": "rCreatorWallet",
        "username": "creator",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true,
        "role": "admin",
        "joinedAt": "2025-01-01T00:00:00.000Z",
        "isCreator": true
      },
      {
        "walletAddress": "rMemberWallet",
        "username": "member",
        "profileImage": null,
        "isVerified": false,
        "role": "member",
        "joinedAt": "2025-01-10T00:00:00.000Z",
        "isCreator": false
      }
    ],
    "total": 15
  }
}
```

**Notes:**
- Members sorted by role (admins first) then by join date
- `isCreator` flag identifies the group creator

---

## Admin Management

### Make Admin

**POST** `/group-chat/:groupId/make-admin`

Promote a member to admin. Only admins can promote other members.

**Parameters:**
- `groupId` (path parameter): Group UUID

**Request Body:**
```json
{
  "walletAddress": "rAdminWalletAddress",
  "memberWalletAddress": "rMemberToPromoteWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Member made admin successfully",
  "data": {
    "memberWalletAddress": "rMemberToPromoteWalletAddress",
    "newRole": "admin"
  }
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "Member is already an admin"
}
```

---

### Remove Admin

**POST** `/group-chat/:groupId/remove-admin`

Remove admin privileges from a member. Only the group creator can remove admin privileges.

**Parameters:**
- `groupId` (path parameter): Group UUID

**Request Body:**
```json
{
  "walletAddress": "rCreatorWalletAddress",
  "memberWalletAddress": "rAdminToDemoteWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Admin privileges removed successfully",
  "data": {
    "memberWalletAddress": "rAdminToDemoteWalletAddress",
    "newRole": "member"
  }
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "Only the group creator can remove admin privileges"
}
```

**Error (403):**
```json
{
  "success": false,
  "message": "Cannot remove admin from group creator"
}
```

---

## Messaging

### Send Message

**POST** `/group-chat/:groupId/messages`

Send a message to the group.

**Parameters:**
- `groupId` (path parameter): Group UUID

**Request Body:**
```json
{
  "senderWalletAddress": "rSenderWalletAddress",
  "content": "Hello everyone!",
  "messageType": "text",
  "metadata": null,
  "replyToMessageId": null
}
```

**Request Body (NFT Share):**
```json
{
  "senderWalletAddress": "rSenderWalletAddress",
  "content": "Check out this NFT!",
  "messageType": "nft_share",
  "metadata": {
    "nftTokenId": "00081388...",
    "collectionName": "Cool Collection",
    "nftName": "Cool NFT #123",
    "image": "https://example.com/nft.jpg",
    "price": "1000000"
  }
}
```

**Request Body (Reply):**
```json
{
  "senderWalletAddress": "rSenderWalletAddress",
  "content": "I agree with this!",
  "messageType": "text",
  "replyToMessageId": "original-message-uuid"
}
```

**Fields:**
- `senderWalletAddress` (required): Sender's wallet address
- `content` (required): Message content
- `messageType` (optional): `text`, `image`, `nft_share`, or `system` (default: `text`)
- `metadata` (optional): Additional data for rich messages
- `replyToMessageId` (optional): UUID of message being replied to

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": {
      "id": "uuid",
      "groupId": "group-uuid",
      "senderWalletAddress": "rSenderWalletAddress",
      "sender": {
        "walletAddress": "rSenderWalletAddress",
        "username": "sender_name",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true
      },
      "content": "Hello everyone!",
      "messageType": "text",
      "metadata": null,
      "replyToMessageId": null,
      "replyToMessage": null,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

**Response (201) with Reply:**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": {
      "id": "uuid",
      "groupId": "group-uuid",
      "senderWalletAddress": "rSenderWalletAddress",
      "sender": {
        "walletAddress": "rSenderWalletAddress",
        "username": "sender_name",
        "profileImage": "https://example.com/avatar.jpg",
        "isVerified": true
      },
      "content": "I agree with this!",
      "messageType": "text",
      "metadata": null,
      "replyToMessageId": "original-message-uuid",
      "replyToMessage": {
        "id": "original-message-uuid",
        "content": "Original message content",
        "senderWalletAddress": "rOriginalSenderWallet",
        "sender": {
          "walletAddress": "rOriginalSenderWallet",
          "username": "original_sender",
          "profileImage": "https://example.com/avatar2.jpg"
        }
      },
      "createdAt": "2025-01-15T10:35:00.000Z"
    }
  }
}
```

---

### Get Messages

**GET** `/group-chat/:groupId/messages/:walletAddress?page=1&limit=50`

Get messages from a group with pagination.

**Parameters:**
- `groupId` (path parameter): Group UUID
- `walletAddress` (path parameter): Requesting user's wallet address

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 50)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Messages retrieved successfully",
  "data": {
    "messages": [
      {
        "id": "uuid",
        "groupId": "group-uuid",
        "senderWalletAddress": "rSenderWalletAddress",
        "sender": {
          "walletAddress": "rSenderWalletAddress",
          "username": "sender_name",
          "profileImage": "https://example.com/avatar.jpg",
          "isVerified": true
        },
        "content": "Hello everyone!",
        "messageType": "text",
        "metadata": null,
        "replyToMessageId": null,
        "replyToMessage": null,
        "createdAt": "2025-01-15T10:30:00.000Z"
      },
      {
        "id": "uuid",
        "groupId": "group-uuid",
        "senderWalletAddress": "rCreatorWalletAddress",
        "sender": {
          "walletAddress": "rCreatorWalletAddress",
          "username": "creator_name",
          "profileImage": null,
          "isVerified": false
        },
        "content": "creator_name created the group",
        "messageType": "system",
        "metadata": null,
        "replyToMessageId": null,
        "replyToMessage": null,
        "createdAt": "2025-01-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "totalPages": 1
    }
  }
}
```

**Notes:**
- Messages returned in chronological order (oldest first)
- Pagination fetches from newest messages
- Automatically updates user's `lastReadAt` timestamp

---

### Mark Messages as Read

**PUT** `/group-chat/:groupId/read`

Mark all group messages as read for the user.

**Parameters:**
- `groupId` (path parameter): Group UUID

**Request Body:**
```json
{
  "walletAddress": "rUserWalletAddress"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Messages marked as read",
  "data": null
}
```

---

### Get Unread Count (Detailed)

**GET** `/group-chat/unread/:walletAddress`

Get unread message counts for all groups with breakdown.

**Parameters:**
- `walletAddress` (path parameter): User's wallet address

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Unread count retrieved successfully",
  "data": {
    "totalUnread": 15,
    "unreadByGroup": [
      {
        "groupId": "group-uuid-1",
        "groupName": "NFT Collectors",
        "groupImage": "https://example.com/group1.jpg",
        "unreadCount": 10
      },
      {
        "groupId": "group-uuid-2",
        "groupName": "Crypto Traders",
        "groupImage": "https://example.com/group2.jpg",
        "unreadCount": 5
      }
    ]
  }
}
```

---

### Get Total Unread Count (Badge)

**GET** `/group-chat/unread-count/:walletAddress`

Get only the total unread count. Lightweight endpoint for notification badges.

**Parameters:**
- `walletAddress` (path parameter): User's wallet address

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Unread count retrieved successfully",
  "data": {
    "count": 15
  }
}
```

---

## Message Types

| Type | Description | Metadata |
|------|-------------|----------|
| `text` | Plain text message | None required |
| `image` | Image message | `{ "imageUrl": "https://..." }` |
| `nft_share` | NFT share | `{ "nftTokenId": "...", "collectionName": "...", "nftName": "...", "image": "...", "price": "..." }` |
| `system` | System-generated message | None (auto-generated for joins/leaves/admin changes) |

---

## Member Roles

| Role | Permissions |
|------|-------------|
| `member` | Send messages, view group, leave group |
| `admin` | All member permissions + add/remove members, update group info, make other admins |
| `creator` (admin) | All admin permissions + delete group, remove admin from others |

---

## Data Models

### Group

```json
{
  "id": "uuid",
  "name": "Group Name",
  "description": "Group description",
  "groupImage": "https://example.com/group.jpg",
  "creatorWalletAddress": "rCreatorWallet",
  "lastMessageAt": "2025-01-15T10:30:00.000Z",
  "lastMessagePreview": "Last message content...",
  "lastMessageSenderWallet": "rSenderWallet",
  "memberCount": 15,
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### GroupMember

```json
{
  "id": "uuid",
  "groupId": "group-uuid",
  "walletAddress": "rMemberWallet",
  "role": "admin|member",
  "joinedAt": "2025-01-01T00:00:00.000Z",
  "addedByWalletAddress": "rAdderWallet",
  "lastReadAt": "2025-01-15T10:30:00.000Z",
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### GroupMessage

```json
{
  "id": "uuid",
  "groupId": "group-uuid",
  "senderWalletAddress": "rSenderWallet",
  "content": "Message content",
  "messageType": "text|image|nft_share|system",
  "metadata": {},
  "replyToMessageId": "replied-message-uuid",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

---

## Example Integration Flow

```javascript
// 1. Get wallet address (from XAMAN connection)
const walletAddress = localStorage.getItem('walletAddress');

// 2. Create a new group
const createGroup = await fetch('/api/v1/group-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    creatorWalletAddress: walletAddress,
    name: 'My NFT Group',
    description: 'A group for NFT discussions',
    memberWalletAddresses: ['rMember1Wallet', 'rMember2Wallet']
  })
});

// 3. Get user's groups
const groups = await fetch(`/api/v1/group-chat/groups/${walletAddress}`);

// 4. Get messages from a group
const messages = await fetch(
  `/api/v1/group-chat/${groupId}/messages/${walletAddress}?page=1&limit=50`
);

// 5. Send a message to the group
const sendMessage = await fetch(`/api/v1/group-chat/${groupId}/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    senderWalletAddress: walletAddress,
    content: 'Hello everyone!',
    messageType: 'text'
  })
});

// 6. Reply to a message
const replyMessage = await fetch(`/api/v1/group-chat/${groupId}/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    senderWalletAddress: walletAddress,
    content: 'I agree!',
    messageType: 'text',
    replyToMessageId: 'original-message-uuid'
  })
});

// 7. Add a new member (admin only)
const addMember = await fetch(`/api/v1/group-chat/${groupId}/members`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: walletAddress,  // admin's wallet
    memberWalletAddresses: ['rNewMemberWallet']
  })
});

// 8. Get unread count for notification badge
const unreadCount = await fetch(`/api/v1/group-chat/unread-count/${walletAddress}`);

// 9. Mark messages as read
await fetch(`/api/v1/group-chat/${groupId}/read`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: walletAddress
  })
});

// 10. Leave a group
await fetch(`/api/v1/group-chat/${groupId}/leave`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: walletAddress
  })
});
```

---

## Error Responses

| Status Code | Description |
|-------------|-------------|
| 400 | Bad request (missing required fields) |
| 403 | Forbidden (not a member, not an admin, not creator) |
| 404 | Not found (group, member, or message not found) |
| 500 | Internal server error |

---

## Related Documentation

- [Chat API Documentation](../API_DOCUMENTATION.md#chat-endpoints) - Direct messaging between two users
- [Admin API Documentation](./ADMIN_API_DOCUMENTATION.md) - Admin panel operations
