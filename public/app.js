// Global variables
let groups = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadGroups();
    setupFormSubmission();
});

/**
 * Load groups from the server
 */
async function loadGroups() {
    try {
        showLoading('groupStatus');

        const response = await fetch('/api/groups');
        const data = await response.json();

        if (data.success) {
            groups = data.groups;
            displayGroups(groups);
            populateGroupDropdown(groups);
        } else {
            showMessage('Không thể tải thông tin nhóm', 'error');
        }
    } catch (error) {
        console.error('Error loading groups:', error);
        showMessage('Lỗi khi tải thông tin nhóm', 'error');
    }
}

/**
 * Display groups in the status panel
 */
function displayGroups(groups) {
    const container = document.getElementById('groupStatus');

    if (groups.length === 0) {
        container.innerHTML = '<div class="loading">Không có nhóm nào</div>';
        return;
    }

    container.innerHTML = groups.map(group => {
        const percentage = (group.count / group.maxStudents) * 100;
        const isFull = group.isFull;

        return `
            <div class="group-card ${isFull ? 'full' : ''}">
                <div class="group-card-header">
                    <span class="group-name">${escapeHtml(group.name)}</span>
                    <span class="group-badge ${isFull ? 'full' : 'available'}">
                        ${isFull ? 'ĐẦY' : 'CÒN CHỖ'}
                    </span>
                </div>
                <div class="group-progress">
                    <div class="progress-bar-bg">
                        <div class="progress-bar ${isFull ? 'full' : ''}"
                             style="width: ${percentage}%">
                        </div>
                    </div>
                    <div class="progress-text">
                        ${group.count} / ${group.maxStudents} học viên
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Populate the group dropdown
 */
function populateGroupDropdown(groups) {
    const select = document.getElementById('group');

    // Clear existing options except the first one
    select.innerHTML = '<option value="">-- Chọn nhóm --</option>';

    // Add group options
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.name;
        option.textContent = `${group.name} (${group.count}/${group.maxStudents})`;

        // Disable full groups
        if (group.isFull) {
            option.disabled = true;
            option.textContent += ' - ĐẦY';
        }

        select.appendChild(option);
    });

    // Update group info on selection change
    select.addEventListener('change', (e) => {
        updateGroupInfo(e.target.value);
    });
}

/**
 * Update group info text
 */
function updateGroupInfo(groupName) {
    const groupInfo = document.getElementById('groupInfo');

    if (!groupName) {
        groupInfo.textContent = '';
        return;
    }

    const group = groups.find(g => g.name === groupName);
    if (group) {
        const remaining = group.maxStudents - group.count;
        groupInfo.textContent = `Còn ${remaining} chỗ trống`;
        groupInfo.style.color = remaining <= 2 ? '#e74c3c' : '#28a745';
    }
}

/**
 * Setup form submission
 */
function setupFormSubmission() {
    const form = document.getElementById('registrationForm');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get form data
        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            school: document.getElementById('school').value.trim(),
            group: document.getElementById('group').value
        };

        // Validate
        if (!formData.name || !formData.email || !formData.phone ||
            !formData.school || !formData.group) {
            showMessage('Vui lòng điền đầy đủ thông tin', 'error');
            return;
        }

        // Validate reCAPTCHA
        const recaptchaResponse = grecaptcha.getResponse();
        const recaptchaError = document.getElementById('recaptchaError');

        if (!recaptchaResponse) {
            recaptchaError.style.display = 'block';
            showMessage('Vui lòng xác minh reCAPTCHA', 'error');
            return;
        }

        recaptchaError.style.display = 'none';
        formData.recaptchaToken = recaptchaResponse;

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang đăng ký...';

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                showMessage('Đăng ký thành công!', 'success');
                form.reset();
                grecaptcha.reset(); // Reset reCAPTCHA
                // Reload groups to update counts
                await loadGroups();
            } else {
                showMessage(data.message || 'Đăng ký thất bại', 'error');
                grecaptcha.reset(); // Reset reCAPTCHA on error
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            showMessage('Lỗi khi đăng ký. Vui lòng thử lại.', 'error');
            grecaptcha.reset(); // Reset reCAPTCHA on error
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đăng Ký';
        }
    });
}

/**
 * Show loading message
 */
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="loading">Đang tải...</div>';
    }
}

/**
 * Show message to user
 */
function showMessage(message, type = 'info') {
    const container = document.getElementById('messageContainer');

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;

    container.appendChild(messageDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
        messageDiv.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            container.removeChild(messageDiv);
        }, 300);
    }, 5000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Auto refresh groups every 1 minute
 */
setInterval(() => {
    loadGroups();
}, 60000);
