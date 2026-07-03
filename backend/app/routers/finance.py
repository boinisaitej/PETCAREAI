from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, timedelta
from ..database import get_db, Expense, InsurancePolicy, Pet, User
from ..auth import get_current_user

router = APIRouter(prefix="/api/finance", tags=["Finance"])

EXPENSE_CATEGORIES = {"food", "medicine", "vet", "grooming", "insurance", "toys", "training", "other"}


class ExpenseCreate(BaseModel):
    pet_id: int
    category: str
    amount: float
    description: Optional[str] = None
    spent_at: Optional[datetime] = None

    @field_validator("category")
    @classmethod
    def valid_category(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in EXPENSE_CATEGORIES:
            raise ValueError(f"Category must be one of: {', '.join(sorted(EXPENSE_CATEGORIES))}")
        return v

    @field_validator("amount")
    @classmethod
    def valid_amount(cls, v: float) -> float:
        if v <= 0 or v > 10_000_000:
            raise ValueError("Amount must be a positive number")
        return v


class InsuranceCreate(BaseModel):
    pet_id: int
    provider: str
    policy_number: Optional[str] = None
    coverage_summary: Optional[str] = None
    premium_amount: Optional[float] = None
    premium_frequency: str = "monthly"
    start_date: Optional[datetime] = None
    renewal_date: Optional[datetime] = None

    @field_validator("provider")
    @classmethod
    def provider_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Provider is required")
        return v


def _expense_dict(e: Expense) -> dict:
    return {
        "id": e.id, "pet_id": e.pet_id, "category": e.category, "amount": e.amount,
        "description": e.description, "spent_at": e.spent_at.isoformat() if e.spent_at else None,
    }


def _policy_dict(p: InsurancePolicy) -> dict:
    return {
        "id": p.id, "pet_id": p.pet_id, "provider": p.provider, "policy_number": p.policy_number,
        "coverage_summary": p.coverage_summary, "premium_amount": p.premium_amount,
        "premium_frequency": p.premium_frequency, "is_active": p.is_active,
        "start_date": p.start_date.isoformat() if p.start_date else None,
        "renewal_date": p.renewal_date.isoformat() if p.renewal_date else None,
    }


# ── Expenses ───────────────────────────────────────────────────────────────────
@router.post("/expenses")
def add_expense(data: ExpenseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == data.pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    expense = Expense(
        pet_id=data.pet_id, user_id=current_user.id, category=data.category,
        amount=data.amount, description=data.description,
        spent_at=data.spent_at or datetime.utcnow(),
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return _expense_dict(expense)


@router.get("/expenses")
def list_expenses(pet_id: Optional[int] = None, months: int = 12,
                  db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    since = datetime.utcnow() - timedelta(days=months * 30)
    q = db.query(Expense).filter(Expense.user_id == current_user.id, Expense.spent_at >= since)
    if pet_id:
        q = q.filter(Expense.pet_id == pet_id)
    expenses = q.order_by(Expense.spent_at.desc()).all()
    return [_expense_dict(e) for e in expenses]


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.user_id == current_user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted"}


@router.get("/expenses-summary")
def expense_summary(pet_id: Optional[int] = None, months: int = 6,
                    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    since = datetime.utcnow() - timedelta(days=months * 30)
    q = db.query(Expense).filter(Expense.user_id == current_user.id, Expense.spent_at >= since)
    if pet_id:
        q = q.filter(Expense.pet_id == pet_id)
    expenses = q.all()

    by_category: dict[str, float] = {}
    by_month: dict[str, float] = {}
    for e in expenses:
        by_category[e.category] = round(by_category.get(e.category, 0) + e.amount, 2)
        month_key = e.spent_at.strftime("%Y-%m") if e.spent_at else "unknown"
        by_month[month_key] = round(by_month.get(month_key, 0) + e.amount, 2)

    total = round(sum(e.amount for e in expenses), 2)
    this_month_key = datetime.utcnow().strftime("%Y-%m")
    return {
        "total": total,
        "this_month": by_month.get(this_month_key, 0),
        "count": len(expenses),
        "by_category": [{"category": k, "amount": v} for k, v in sorted(by_category.items(), key=lambda x: -x[1])],
        "by_month": [{"month": k, "amount": v} for k, v in sorted(by_month.items())],
    }


# ── Insurance ──────────────────────────────────────────────────────────────────
@router.post("/insurance")
def add_policy(data: InsuranceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == data.pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    policy = InsurancePolicy(user_id=current_user.id, **data.model_dump())
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return _policy_dict(policy)


@router.get("/insurance")
def list_policies(pet_id: Optional[int] = None,
                  db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(InsurancePolicy).filter(InsurancePolicy.user_id == current_user.id)
    if pet_id:
        q = q.filter(InsurancePolicy.pet_id == pet_id)
    return [_policy_dict(p) for p in q.order_by(InsurancePolicy.renewal_date).all()]


@router.put("/insurance/{policy_id}/toggle")
def toggle_policy(policy_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    policy = db.query(InsurancePolicy).filter(
        InsurancePolicy.id == policy_id, InsurancePolicy.user_id == current_user.id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    policy.is_active = not policy.is_active
    db.commit()
    return _policy_dict(policy)


@router.delete("/insurance/{policy_id}")
def delete_policy(policy_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    policy = db.query(InsurancePolicy).filter(
        InsurancePolicy.id == policy_id, InsurancePolicy.user_id == current_user.id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    db.delete(policy)
    db.commit()
    return {"message": "Policy deleted"}
