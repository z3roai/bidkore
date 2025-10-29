/**
 * Smart validation utilities with user-friendly error messages
 * Replaces native browser validation messages with custom notifications
 */

export interface ValidationResult {
  isValid: boolean
  message?: string
}

export interface FieldValidation {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  customValidation?: (value: string) => ValidationResult
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === "") {
    return {
      isValid: false,
      message: "Please enter your email address"
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      message: "Please enter a valid email address (e.g., name@example.com)"
    }
  }

  return { isValid: true }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string, fieldName = "Password"): ValidationResult {
  if (!password || password.trim() === "") {
    return {
      isValid: false,
      message: `${fieldName} is required`
    }
  }

  if (password.length < 8) {
    return {
      isValid: false,
      message: `${fieldName} must be at least 8 characters long`
    }
  }

  if (password.length > 128) {
    return {
      isValid: false,
      message: `${fieldName} must be less than 128 characters`
    }
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: `${fieldName} must contain at least one uppercase letter`
    }
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: `${fieldName} must contain at least one lowercase letter`
    }
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    return {
      isValid: false,
      message: `${fieldName} must contain at least one number`
    }
  }

  return { isValid: true }
}

/**
 * Validate required text field
 */
export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value || value.trim() === "") {
    return {
      isValid: false,
      message: `${fieldName} is required`
    }
  }

  return { isValid: true }
}

/**
 * Validate name field
 */
export function validateName(name: string, fieldName: string): ValidationResult {
  if (!name || name.trim() === "") {
    return {
      isValid: false,
      message: `Please enter your ${fieldName.toLowerCase()}`
    }
  }

  if (name.trim().length < 2) {
    return {
      isValid: false,
      message: `${fieldName} must be at least 2 characters long`
    }
  }

  if (name.trim().length > 50) {
    return {
      isValid: false,
      message: `${fieldName} must be less than 50 characters`
    }
  }

  // Check if name contains only letters, spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z\s'-]+$/.test(name)) {
    return {
      isValid: false,
      message: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`
    }
  }

  return { isValid: true }
}

/**
 * Validate checkbox (terms and conditions)
 */
export function validateCheckbox(checked: boolean, fieldName: string): ValidationResult {
  if (!checked) {
    return {
      isValid: false,
      message: `Please accept the ${fieldName}`
    }
  }

  return { isValid: true }
}

/**
 * Validate form field with custom rules
 */
export function validateField(
  value: string,
  fieldName: string,
  rules: FieldValidation
): ValidationResult {
  // Required validation
  if (rules.required) {
    const result = validateRequired(value, fieldName)
    if (!result.isValid) return result
  }

  // Skip other validations if value is empty and not required
  if (!value || value.trim() === "") {
    return { isValid: true }
  }

  // Min length validation
  if (rules.minLength && value.length < rules.minLength) {
    return {
      isValid: false,
      message: `${fieldName} must be at least ${rules.minLength} characters long`
    }
  }

  // Max length validation
  if (rules.maxLength && value.length > rules.maxLength) {
    return {
      isValid: false,
      message: `${fieldName} must be less than ${rules.maxLength} characters`
    }
  }

  // Pattern validation
  if (rules.pattern && !rules.pattern.test(value)) {
    return {
      isValid: false,
      message: `Please enter a valid ${fieldName.toLowerCase()}`
    }
  }

  // Custom validation
  if (rules.customValidation) {
    return rules.customValidation(value)
  }

  return { isValid: true }
}

/**
 * Validate entire form
 */
export function validateForm(
  formData: Record<string, string | boolean>,
  validationRules: Record<string, FieldValidation>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  let isValid = true

  Object.keys(validationRules).forEach((fieldName) => {
    const value = formData[fieldName]
    const rules = validationRules[fieldName]
    const stringValue = typeof value === 'string' ? value : String(value)
    const result = validateField(stringValue, fieldName, rules)

    if (!result.isValid) {
      errors[fieldName] = result.message || `Invalid ${fieldName}`
      isValid = false
    }
  })

  return { isValid, errors }
}

/**
 * Smart validation messages for common scenarios
 */
export const validationMessages = {
  email: {
    required: "Please enter your email address",
    invalid: "Please enter a valid email address (e.g., name@example.com)",
    alreadyExists: "This email is already registered"
  },
  password: {
    required: "Please enter a password",
    tooShort: "Password must be at least 8 characters long",
    tooWeak: "Password must include uppercase, lowercase, and numbers",
    noMatch: "Passwords do not match"
  },
  name: {
    firstName: "Please enter your first name",
    lastName: "Please enter your last name",
    tooShort: "Name must be at least 2 characters long",
    invalid: "Name can only contain letters, spaces, hyphens, and apostrophes"
  },
  terms: {
    required: "Please accept the Terms of Service and Privacy Policy to continue"
  }
}

