document.addEventListener('DOMContentLoaded', () => {
  const statusIndicator = document.getElementById('status-indicator');
  const myIdDisplay = document.getElementById('my-id-display');
  const myNameInput = document.getElementById('my-name-input');
  const contactsSelect = document.getElementById('private-contacts');
  const targetInput = document.getElementById('private-target');

  // Groups UI Elements
  const groupSelect = document.getElementById('group-select');
  const showCreateGroupBtn = document.getElementById('show-create-group-btn');
  const selectedGroupInfo = document.getElementById('selected-group-info');
  const groupMembersDisplay = document.getElementById('group-members-display');
  const leaveGroupBtn = document.getElementById('leave-group-btn');
  const createGroupPanel = document.getElementById('create-group-panel');
  const newGroupNameInput = document.getElementById('new-group-name');
  const checklistContainer = document.getElementById('group-contacts-checklist');
  const createGroupSubmitBtn = document.getElementById('create-group-submit-btn');
  const createGroupCancelBtn = document.getElementById('create-group-cancel-btn');
  const groupSendArea = document.getElementById('group-send-area');
  const groupInput = document.getElementById('group-input');
  const groupSendBtn = document.getElementById('group-send-btn');
  const editGroupBtn = document.getElementById('edit-group-btn');
  const groupPanelTitle = document.getElementById('group-panel-title');
  const groupAddMemberIdInput = document.getElementById('group-add-member-id');
  const groupAddMemberBtn = document.getElementById('group-add-member-btn');

  let myDisplayName = "Anonymous";
  let myContacts = [];
  let myGroups = [];
  let currentUserId = "";
  let editingGroupId = null;

  // Tabs Logic
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Render Contacts Dropdown (Private Tab)
  function renderContacts() {
    const currentSelectedValue = contactsSelect.value;
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

    if (currentSelectedValue && Array.from(contactsSelect.options).some(opt => opt.value === currentSelectedValue)) {
      contactsSelect.value = currentSelectedValue;
    } else {
      contactsSelect.value = '';
    }
  }

  // Render Groups Dropdown Selector (Group Tab)
  function renderGroups() {
    const currentSelectedValue = groupSelect.value;
    groupSelect.innerHTML = '<option value="global">🌐 Global Chat (Everyone)</option>';
    myGroups.forEach(grp => {
      const opt = document.createElement('option');
      opt.value = grp.id;
      opt.textContent = `👥 ${grp.name} (${grp.members.length} members)`;
      groupSelect.appendChild(opt);
    });

    if (currentSelectedValue && Array.from(groupSelect.options).some(opt => opt.value === currentSelectedValue)) {
      groupSelect.value = currentSelectedValue;
    } else {
      groupSelect.value = 'global';
    }
  }

  // Render Scrollable Contacts Checklist for Group Creation (Constraints enforced)
  function renderContactsChecklist(preCheckedMembers = []) {
    checklistContainer.innerHTML = '';
    const renderedIds = new Set();

    // Helper to render a checkbox item
    function renderItem(id, displayName, isChecked) {
      if (renderedIds.has(id)) return;
      renderedIds.add(id);

      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.gap = '8px';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = id;
      chk.className = 'group-contact-checkbox';
      chk.id = `chk-${id}`;
      chk.style.margin = '0';
      chk.style.cursor = 'pointer';
      chk.checked = isChecked;

      const lbl = document.createElement('label');
      lbl.htmlFor = chk.id;
      lbl.style.fontSize = '12px';
      lbl.style.cursor = 'pointer';
      lbl.style.color = 'var(--text-light)';
      lbl.textContent = displayName;

      div.appendChild(chk);
      div.appendChild(lbl);
      checklistContainer.appendChild(div);
    }

    // 1. Render all saved contacts
    myContacts.forEach(contact => {
      const contactVal = typeof contact === 'string' ? contact : contact.id;
      const displayName = typeof contact === 'string' ? contact : `${contact.name} (${contact.id})`;
      const isChecked = preCheckedMembers.includes(contactVal);
      renderItem(contactVal, displayName, isChecked);
    });

    // 2. Render any existing group members who are NOT in contacts
    preCheckedMembers.forEach(memberId => {
      if (memberId === currentUserId) return;
      if (!renderedIds.has(memberId)) {
        renderItem(memberId, `Existing Member (${memberId})`, true);
      }
    });

    if (renderedIds.size === 0) {
      checklistContainer.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 10px 0; width: 100%;">No saved contacts yet. Add contacts in the Private tab first!</span>';
    }
  }

  // Update selected custom group view info banner, placeholders
  function updateSelectedGroupView() {
    const val = groupSelect.value;
    if (val === 'global') {
      selectedGroupInfo.style.display = 'none';
      groupInput.placeholder = 'Message everyone...';
      groupSendBtn.textContent = 'Send to Group';
    } else {
      const activeGrp = myGroups.find(g => g.id === val);
      if (activeGrp) {
        selectedGroupInfo.style.display = 'flex';
        
        // Resolve names for display
        const resolvedNames = activeGrp.members.map(memberId => {
          if (memberId === currentUserId) return 'You';
          const match = myContacts.find(c => (typeof c === 'string' ? c === memberId : c.id === memberId));
          if (match) {
            return typeof match === 'string' ? match : match.name;
          }
          return memberId;
        });

        groupMembersDisplay.textContent = resolvedNames.join(', ');
        groupMembersDisplay.title = activeGrp.members.join(', '); // tooltip shows IDs
        
        groupInput.placeholder = `Message ${activeGrp.name}...`;
        groupSendBtn.textContent = `Send to ${activeGrp.name}`;
      } else {
        selectedGroupInfo.style.display = 'none';
      }
    }
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
          renderContactsChecklist();
        }
        if (msg.groups) {
          myGroups = msg.groups;
          renderGroups();
          updateSelectedGroupView();
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
          currentUserId = msg.userId;
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
        // Refresh contacts and groups
        window.parent.postMessage({ source: 'waifuwire-iframe', type: 'GET_DATA' }, '*');
      }
      
      else if (msg.type === 'SEND_GROUP_MSG_RESPONSE') {
        if (msg.success) {
          groupInput.value = '';
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

      else if (msg.type === 'LEAVE_GROUP_RESPONSE') {
        // Refresh data to reflect deleted group
        window.parent.postMessage({ source: 'waifuwire-iframe', type: 'GET_DATA' }, '*');
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

  // Group Selection Changed
  groupSelect.addEventListener('change', updateSelectedGroupView);

  // Leave Group Action
  leaveGroupBtn.addEventListener('click', () => {
    const val = groupSelect.value;
    if (val === 'global') return;
    
    const activeGrp = myGroups.find(g => g.id === val);
    if (activeGrp) {
      if (confirm(`Are you sure you want to leave the group "${activeGrp.name}"?`)) {
        window.parent.postMessage({
          source: 'waifuwire-iframe',
          type: 'LEAVE_GROUP',
          groupId: activeGrp.id,
          members: activeGrp.members
        }, '*');
        
        // Instantly switch back to global
        groupSelect.value = 'global';
        updateSelectedGroupView();
      }
    }
  });

  // Show Create Group Panel
  showCreateGroupBtn.addEventListener('click', () => {
    editingGroupId = null;
    groupPanelTitle.textContent = 'Create Custom Group';
    createGroupSubmitBtn.textContent = 'Create';
    newGroupNameInput.value = '';
    renderContactsChecklist();
    createGroupPanel.style.display = 'flex';
    groupSendArea.style.display = 'none';
    selectedGroupInfo.style.display = 'none';
  });

  // Edit Group Button Listener (Add/Remove members on existing group)
  editGroupBtn.addEventListener('click', () => {
    const val = groupSelect.value;
    if (val === 'global') return;
    const activeGrp = myGroups.find(g => g.id === val);
    if (activeGrp) {
      editingGroupId = activeGrp.id;
      groupPanelTitle.textContent = 'Manage Group';
      createGroupSubmitBtn.textContent = 'Save';
      newGroupNameInput.value = activeGrp.name;
      
      // Exclude yourself from the checklist rendering, since own ID is auto-added
      const membersExcludingMe = activeGrp.members.filter(m => m !== currentUserId);
      renderContactsChecklist(membersExcludingMe);
      
      createGroupPanel.style.display = 'flex';
      groupSendArea.style.display = 'none';
      selectedGroupInfo.style.display = 'none';
    }
  });

  // Cancel Group Creation/Editing
  createGroupCancelBtn.addEventListener('click', () => {
    editingGroupId = null;
    groupPanelTitle.textContent = 'Create Custom Group';
    createGroupSubmitBtn.textContent = 'Create';
    createGroupPanel.style.display = 'none';
    groupSendArea.style.display = 'flex';
    updateSelectedGroupView();
  });

  // Generate a random 6-digit GRP ID
  function generateGroupId() {
    return 'GRP-' + Math.floor(100000 + Math.random() * 900000);
  }

  // Create/Edit Group Submit Action
  createGroupSubmitBtn.addEventListener('click', () => {
    const name = newGroupNameInput.value.trim();
    if (!name) {
      alert('Please enter a group name.');
      return;
    }

    const checked = Array.from(document.querySelectorAll('.group-contact-checkbox:checked')).map(el => el.value);
    if (checked.length === 0) {
      alert('Please select or add at least one member to the group!');
      return;
    }

    // Automatically append own ID to group members
    if (currentUserId && !checked.includes(currentUserId)) {
      checked.push(currentUserId);
    }

    let finalGroupId;

    if (editingGroupId) {
      // Editing Mode
      finalGroupId = editingGroupId;
      const activeGrp = myGroups.find(g => g.id === editingGroupId);
      if (activeGrp) {
        activeGrp.name = name;
        activeGrp.members = checked;
        
        window.parent.postMessage({
          source: 'waifuwire-iframe',
          type: 'SAVE_GROUPS',
          groups: myGroups
        }, '*');

        // Broadcast a system update so everyone online auto-registers the updated membership roster
        const targetGroupId = editingGroupId;
        setTimeout(() => {
          window.parent.postMessage({
            source: 'waifuwire-iframe',
            type: 'SEND_GROUP_MSG',
            text: `Group settings and members have been updated!`,
            senderName: 'System Notice',
            groupId: targetGroupId,
            groupName: name,
            members: checked
          }, '*');
        }, 100);
      }
    } else {
      // Creation Mode
      const newGroupId = generateGroupId();
      finalGroupId = newGroupId;
      const newGroup = {
        id: newGroupId,
        name: name,
        members: checked
      };

      const updatedGroups = [...myGroups, newGroup];
      window.parent.postMessage({
        source: 'waifuwire-iframe',
        type: 'SAVE_GROUPS',
        groups: updatedGroups
      }, '*');

      // Automatically send a system group notification to sync the group with all other members
      setTimeout(() => {
        window.parent.postMessage({
          source: 'waifuwire-iframe',
          type: 'SEND_GROUP_MSG',
          text: `Group "${name}" has been created!`,
          senderName: 'System Notice',
          groupId: newGroupId,
          groupName: name,
          members: checked
        }, '*');
      }, 100);
    }

    // Reset panel inputs and close
    editingGroupId = null;
    groupPanelTitle.textContent = 'Create Custom Group';
    createGroupSubmitBtn.textContent = 'Create';
    newGroupNameInput.value = '';
    createGroupPanel.style.display = 'none';
    groupSendArea.style.display = 'flex';

    // Auto-select the newly created or updated group after a brief delay for storage synchronization
    setTimeout(() => {
      groupSelect.value = finalGroupId;
      updateSelectedGroupView();
    }, 150);
  });

  // Group Send Action (custom and global support)
  groupSendBtn.addEventListener('click', () => {
    const text = groupInput.value.trim();
    if (!text) return;

    const val = groupSelect.value;
    if (val === 'global') {
      window.parent.postMessage({
        source: 'waifuwire-iframe',
        type: 'SEND_GROUP_MSG',
        text: text,
        senderName: myDisplayName
      }, '*');
    } else {
      const activeGrp = myGroups.find(g => g.id === val);
      if (activeGrp) {
        window.parent.postMessage({
          source: 'waifuwire-iframe',
          type: 'SEND_GROUP_MSG',
          text: text,
          senderName: myDisplayName,
          groupId: activeGrp.id,
          groupName: activeGrp.name,
          members: activeGrp.members
        }, '*');
      }
    }
  });

  // Private Message Send Action
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

  // Test Anime Popup Button
  document.getElementById('test-popup-btn').addEventListener('click', () => {
    window.parent.postMessage({
      source: 'waifuwire-iframe',
      type: 'TEST_POPUP',
      senderName: myDisplayName
    }, '*');
  });

  // Add Member by ID Action
  if (groupAddMemberBtn && groupAddMemberIdInput) {
    groupAddMemberBtn.addEventListener('click', () => {
      const targetId = groupAddMemberIdInput.value.trim();
      if (!targetId) {
        alert('Please enter a User ID.');
        return;
      }

      if (targetId === currentUserId) {
        alert('You are already included in the group by default!');
        return;
      }

      // Check if already in the checklist
      const existingCheckbox = document.getElementById(`chk-${targetId}`);
      if (existingCheckbox) {
        if (existingCheckbox.checked) {
          alert('This member is already added and checked.');
        } else {
          existingCheckbox.checked = true;
          alert('Member has been checked in the list below.');
        }
        groupAddMemberIdInput.value = '';
        return;
      }

      // Clear the "No saved contacts yet" message if it exists
      if (checklistContainer.innerHTML.includes('No saved contacts yet')) {
        checklistContainer.innerHTML = '';
      }

      // Create and append the new checkbox item dynamically
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.gap = '8px';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = targetId;
      chk.className = 'group-contact-checkbox';
      chk.id = `chk-${targetId}`;
      chk.style.margin = '0';
      chk.style.cursor = 'pointer';
      chk.checked = true;

      const lbl = document.createElement('label');
      lbl.htmlFor = chk.id;
      lbl.style.fontSize = '12px';
      lbl.style.cursor = 'pointer';
      lbl.style.color = 'var(--text-light)';
      lbl.textContent = `Added Member (${targetId})`;

      div.appendChild(chk);
      div.appendChild(lbl);
      checklistContainer.appendChild(div);

      // Scroll to bottom
      checklistContainer.scrollTop = checklistContainer.scrollHeight;

      // Clear input
      groupAddMemberIdInput.value = '';
    });
  }
});

