class OrderedLinkedListNode {
  constructor(data) {
    this.data = data;
    this.next = null;
    this.prev = null;
  }
}

class OrderedLinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.messageIds = new Set();
  }

  compareBackward(a, b) {
    if (a.id > b.id) return 1;
    if (a.id === b.id) return 0;
    return -1;
  }

  push(data) {
    if (this.messageIds.has(data.id)) {
      let curr = this.head;
      while (curr) {
        if (curr.data.id === data.id) {
          return curr;
        }
        curr = curr.next;
      }
    }

    this.messageIds.add(data.id);

    if (this.tail === null) {
      const node = new OrderedLinkedListNode(data);
      this.head = this.tail = node;
      return node;
    }

    let prev = this.tail;
    while (prev) {
      const compare = this.compareBackward(data, prev.data);

      if (compare === 1) break;
      else if (compare === 0) return prev;
      else if (compare === -1) prev = prev.prev;
    }

    if (!prev) {
      const next = this.head;
      const node = new OrderedLinkedListNode(data);
      node.next = next;

      next.prev = node;
      this.head = node;

      return node;
    } else {
      const next = prev.next;
      const node = new OrderedLinkedListNode(data);
      node.prev = prev;
      node.next = next;

      if (!next) this.tail = node;
      else next.prev = node;

      prev.next = node;

      return node;
    }
  }

  compareForwardFirst(data) {
    return data.id === 1 || this.messageIds.has(data.id - 1);
  }

  compareForward(a, b) {
    return b.id === a.id + 1;
  }

  list() {
    const result = [];

    let curr = this.head;
    if (!curr || !this.compareForwardFirst(curr.data)) {
      return result;
    }

    while (curr.next && this.compareForward(curr.data, curr.next.data)) {
      result.push(curr.data);
      curr = curr.next;
    }
    result.push(curr.data);

    return result;
  }

  getAllMessages() {
    const result = [];
    let curr = this.head;
    while (curr) {
      result.push(curr.data);
      curr = curr.next;
    }
    return result;
  }

  getCount() {
    return this.messageIds.size;
  }

  has(id) {
    return this.messageIds.has(id);
  }
}

module.exports = { OrderedLinkedList };
