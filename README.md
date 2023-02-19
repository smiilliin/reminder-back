# Reminder-back - Reminder Backend

## Usage

### IReminder

```typescript
{
  id: string;
  title: string | null;
  data: string | null;
  uuid: string;
}
```

### Strings

GET /strings/[language-code]

### GET /

```http
content-type: application/json
Authorization: [token]
```

Response Example

```json
[
  {
    "id": "smile6",
    "title": "fff!",
    "data": "asdf",
    "uuid": "a46fa191-ecb8-43e7-8c63-f387c0cdb3e1"
  },
  {
    "id": "smile6",
    "title": "aaaaaa!",
    "data": "fffffffffff",
    "uuid": "b15f76a9-012a-4446-be91-3e0e8a8073fd"
  },
  {
    "id": "smile6",
    "title": "hi",
    "data": "asdf!",
    "uuid": "b7bab658-891b-47bd-94a7-14593fe8a6b6"
  }
]
```

### POST /

```http
content-type: application/json
Authorization: [token]

{
    "title": "hello world!",
    "data": "hey!!"
}
```

Response Example

```json
{
  "id": "[id]",
  "title": "hello world!",
  "data": "hey!!",
  "uuid": "a7b5d093-336c-4478-9aa4-cf746ad28c2b"
}
```

### PUT /

```http
content-type: application/json
Authorization: [token]

{
    "title": "hello world!",
    "uuid": "b7bab658-891b-47bd-94a7-14593fe8a6b6"
}
```

### DELETE /

```http
content-type: application/json
Authorization: [token]

{
    "uuid": "b7bab658-891b-47bd-94a7-14593fe8a6b6"
}
```
