# Leave Credits System

## Overview

The Leave Credits system automatically accrues vacation leave for regular employees in compliance with Philippine Labor Law (Article 95 - Service Incentive Leave).

## Business Rules

### Entitlement
- Only **REGULAR** employees earn leave credits
- Probationary employees do NOT earn credits until they become regular

### Accrual Rate
- **1.25 days per month** (15 days per year)
- Accrual happens automatically at the end of each month

### Mid-Month Hire Policy
- Employees hired mid-month do NOT receive partial credit for that month
- Credits begin accruing after completing the first full month

### Regularization
- When an employee is regularized, their `regularizationDate` should be set
- Credits accrue from the regularization date forward

## Philippine Labor Law Compliance

This system implements Service Incentive Leave (SIL) per Article 95 of the Labor Code:
- Minimum 5 days per year (we provide 15 days - exceeds requirement)
- Applicable to employees with more than 6 months of service
- Supports both vacation and sick leave tracking

---

## Table of Contents

1. [Database Schema](./SCHEMA.md)
2. [API Endpoints](./API.md)
3. [Usage Guide](./USAGE.md)
4. [Setup & Deployment](./SETUP.md)
