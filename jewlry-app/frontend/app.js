document.addEventListener('DOMContentLoaded', () => {
    // Fetch earrings from the backend
    fetchEarrings();
    setupUploadButton();
    fetchNosePins();
    setupNosePinUploadButton();

    // Tab switching between Earrings / Nose Pins panels
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });
  });
  

  async function fetchEarrings() {
    try {
      const response = await fetch('/api/earrings');
      const earrings = await response.json();
      
      // Display earrings in a selection menu
      displayEarringSelector(earrings);
    } catch (error) {
      console.error('Error fetching earrings:', error);
    }
  }
  
  function displayEarringSelector(earrings) {
    const selectorContainer = document.getElementById('earring-selector');
    
    const heading = selectorContainer.querySelector('h3');
    const uploadform = document.getElementById('upload-form');

    selectorContainer.innerHTML = '';
   selectorContainer.appendChild(heading);
   const noneButton = document.createElement('button');
    noneButton.className = 'earring-option';
    noneButton.innerHTML = `<span>None</span>`;
    noneButton.addEventListener('click', () => {
      window.selectEarring(null);
    });
    selectorContainer.appendChild(noneButton);

    // Create buttons for each earring
    earrings.forEach(earring => {
      const button = document.createElement('button');
      button.className = 'earring-option';
      button.innerHTML = `
        <img src="${earring.originalImageUrl}" alt="${earring.name}" height="50">
        <span>${earring.name}</span>
      `;
      
      button.addEventListener('click', () => {
        // Update the jewlImage source in earrings.js
        window.selectEarring(earring);
      });
      
      selectorContainer.appendChild(button);
    });

    selectorContainer.appendChild(uploadform);
  }

  function setupUploadButton() {
    const form = document.getElementById('earring-upload-form');
    const statusDiv = document.getElementById('upload-status');
    
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const formData = new FormData(form);
      const nameInput = document.getElementById('earring-name');
      const fileInput = document.getElementById('earring-image');
      
      // Show loading status
      statusDiv.className = '';
      statusDiv.textContent = 'Uploading image...';
     
    try {
      console.log('Sending upload request to server...');
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      console.log('Server response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upload error response:', errorData);
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const result = await response.json();
      console.log('Upload success response:', result);
    
      statusDiv.textContent = 'Earring uploaded successfully!';
      statusDiv.className = 'status-success';
      
      // Reset form
      nameInput.value = '';
      fileInput.value = '';
      
      // Refresh earring list
      fetchEarrings();
      
    } catch (error) {
      console.error('Error uploading earring:', error);
      statusDiv.textContent = `Error: ${error.message}`;
      statusDiv.className = 'status-error';
    }
  });
}  

  async function fetchNosePins() {
    try {
      const response = await fetch('/api/nosepins');
      const nosepins = await response.json();

      // Display nose pins in a selection menu
      displayNosePinSelector(nosepins);
    } catch (error) {
      console.error('Error fetching nose pins:', error);
    }
  }

  function displayNosePinSelector(nosepins) {
    const selectorContainer = document.getElementById('nosepin-selector');

    const heading = selectorContainer.querySelector('h3');
    const uploadform = document.getElementById('nosepin-upload-form');

    selectorContainer.innerHTML = '';
    selectorContainer.appendChild(heading);

    const noneButton = document.createElement('button');
    noneButton.className = 'earring-option';
    noneButton.innerHTML = `<span>None</span>`;
    noneButton.addEventListener('click', () => {
      window.selectNosepin(null);
    });
    selectorContainer.appendChild(noneButton);

    // Create buttons for each nose pin
    nosepins.forEach(nosepin => {
      const button = document.createElement('button');
      button.className = 'earring-option';
      button.innerHTML = `
        <img src="${nosepin.originalImageUrl}" alt="${nosepin.name}" height="50">
        <span>${nosepin.name}</span>
      `;

      button.addEventListener('click', () => {
        // Update the noseImage source in earrings.js
        window.selectNosepin(nosepin);
      });

      selectorContainer.appendChild(button);
    });

    selectorContainer.appendChild(uploadform);
  }

  function setupNosePinUploadButton() {
    const form = document.getElementById('nosepin-upload-form-el');
    const statusDiv = document.getElementById('nosepin-upload-status');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const nameInput = document.getElementById('nosepin-name');
      const fileInput = document.getElementById('nosepin-image');

      // Show loading status
      statusDiv.className = '';
      statusDiv.textContent = 'Uploading image...';

    try {
      console.log('Sending nose pin upload request to server...');
      const response = await fetch('/api/upload-nosepin', {
        method: 'POST',
        body: formData
      });

      console.log('Server response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upload error response:', errorData);
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('Nose pin upload success response:', result);

      statusDiv.textContent = 'Nose pin uploaded successfully!';
      statusDiv.className = 'status-success';

      // Reset form
      nameInput.value = '';
      fileInput.value = '';

      // Refresh nose pin list
      fetchNosePins();

    } catch (error) {
      console.error('Error uploading nose pin:', error);
      statusDiv.textContent = `Error: ${error.message}`;
      statusDiv.className = 'status-error';
    }
  });
}