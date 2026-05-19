document.addEventListener('DOMContentLoaded', () => {
  const statusIndicator = document.getElementById('status-indicator');
  const myIdDisplay = document.getElementById('my-id-display');
  const myNameInput = document.getElementById('my-name-input');
  const contactsSelect = document.getElementById('private-contacts');
  const targetInput = document.getElementById('private-target');
  
  let myDisplayName = "Anonymous";
  let myContacts = [];

  // Tabs Logic
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  function renderContacts() {
    contactsSelect.innerHTML = '<option value="">-- Saved Contacts --</option>';
    myContacts.forEach(contact => {
      const opt = document.createElement('option');
      if (typeof contact === 'string') {
        opt.value = contact;
        opt.textContent = contact;
      } else {
        opt.value = contact.id;
        opt.textContent = `${contact.name} (${contact.id})`;
      }
      contactsSelect.appendChild(opt);
    });
  }

  // --- Start Communication Bridge ---

  // Request initial data and status on load
  window.parent.postMessage({ source: 'waifuwire-iframe', type: 'GET_DATA' }, '*');
  window.parent.postMessage({ source: 'waifuwire-iframe', type: 'CHECK_STATUS' }, '*');

  // Handle incoming messages from the extension wrapper
  window.addEventListener('message', (event) => {
    if (event.data && event.data.source === 'waifuwire-extension') {
      const msg = event.data.message;
      
      if (msg.type === 'DATA_RESPONSE') {
        if (msg.displayName) {
          myDisplayName = msg.displayName;
          myNameInput.value = myDisplayName;
        }
        if (msg.contacts) {
          myContacts = msg.contacts;
          renderContacts();
        }
      }
      
      else if (msg.type === 'STATUS_RESPONSE') {
        if (msg.connected) {
          statusIndicator.classList.replace('disconnected', 'connected');
        } else {
          statusIndicator.classList.replace('connected', 'disconnected');
        }
        if (msg.userId) {
          myIdDisplay.textContent = msg.userId;
        }
      }
      
      else if (msg.type === 'STATUS_UPDATE') {
        if (msg.connected) {
          statusIndicator.classList.replace('disconnected', 'connected');
        } else {
          statusIndicator.classList.replace('connected', 'disconnected');
        }
      }
      
      else if (msg.type === 'CONTACTS_UPDATED') {
        // Refresh contacts
        window.parent.postMessage({ source: 'waifuwire-iframe', type: 'GET_DATA' }, '*');
      }
      
      else if (msg.type === 'SEND_GROUP_MSG_RESPONSE') {
        if (msg.success) {
          document.getElementById('group-input').value = '';
        } else {
          alert('Failed to send. Is the server running?');
        }
      }
      
      else if (msg.type === 'SEND_DIRECT_MSG_RESPONSE') {
        if (msg.success) {
          document.getElementById('private-input').value = '';
        } else {
          alert('Failed to send private message.');
        }
      }
    }
  });

  // --- End Communication Bridge ---

  // Save Name
  document.getElementById('save-name-btn').addEventListener('click', () => {
    const newName = myNameInput.value.trim();
    if (newName) {
      myDisplayName = newName;
      window.parent.postMessage({
        source: 'waifuwire-iframe',
        type: 'SAVE_NAME',
        name: newName
      }, '*');
    }
  });

  // Save Contact
  document.getElementById('add-contact-btn').addEventListener('click', () => {
    const newContact = targetInput.value.trim();
    if (newContact) {
      window.parent.postMessage({
        source: 'waifuwire-iframe',
        type: 'ADD_CONTACT',
        targetId: newContact
      }, '*');
    }
  });

  // Select Contact
  contactsSelect.addEventListener('change', (e) => {
    if (e.target.value) {
      targetInput.value = e.target.value;
    }
  });

  // Delete Contact
  document.getElementById('delete-contact-btn').addEventListener('click', () => {
    const selectedContactId = contactsSelect.value;
    if (selectedContactId) {
      window.parent.postMessage({
        source: 'waifuwire-iframe',
        type: 'DELETE_CONTACT',
        targetId: selectedContactId
      }, '*');
      if (targetInput.value === selectedContactId) {
        targetInput.value = '';
      }
    }
  });

  // Group Send
  document.getElementById('group-send-btn').addEventListener('click', () => {
    const input = document.getElementById('group-input');
    const text = input.value.trim();
    if (!text) return;

    window.parent.postMessage({
      source: 'waifuwire-iframe',
      type: 'SEND_GROUP_MSG',
      text: text,
      senderName: myDisplayName
    }, '*');
  });

  // Private Send
  document.getElementById('private-send-btn').addEventListener('click', () => {
    const targetId = targetInput.value.trim();
    const input = document.getElementById('private-input');
    const text = input.value.trim();
    
    if (!text || !targetId) return;

    window.parent.postMessage({
      source: 'waifuwire-iframe',
      type: 'SEND_DIRECT_MSG',
      targetId: targetId,
      text: text,
      senderName: myDisplayName
    }, '*');
  });

  // Test Popup Button
  document.getElementById('test-popup-btn').addEventListener('click', () => {
    window.parent.postMessage({
      source: 'waifuwire-iframe',
      type: 'TEST_POPUP',
      senderName: myDisplayName
    }, '*');
  });
});
