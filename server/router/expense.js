const express = require("express");
const moment = require("moment");
const router = express.Router();

const Authenticate = require("../middleware/authenticate");
const GroupExpense = require("../models/GroupExpense");
const Group = require("../models/Group");
const User = require("../models/User");
const FriendExpense = require("../models/FriendExpense");
const { calculateSplit, simplifyDebts } = require("../services/expenseServices");

// Helper function for error handling
const handleErrors = (res, error) => {
  console.error(error);
  res.status(500).json({ message: error.message });
};

// Middleware to validate request body
const validateExpenseRequest = (req, res, next) => {
  const { groupId, friendId, paidBy, amount } = req.body;
  if ((!groupId && !friendId) || !paidBy || !amount) {
    return res.status(400).json({ message: "Fill all the necessary details" });
  }
  next();
};

// Add Group Expense
router.post("/addExpense", validateExpenseRequest, async (req, res) => {
  try {
    const { groupId, paidBy, category, description, amount, date } = req.body;
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const members = await User.find({ _id: { $in: group.members } }).lean();
    const membersBalance = calculateSplit(paidBy, members, amount);

    const expense = new GroupExpense({
      description, amount, category, date,
      group: groupId, paidBy, membersBalance, settledMembers: []
    });

    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    handleErrors(res, error);
  }
});

// Add Friend Expense
router.post("/addFriendExpense", validateExpenseRequest, async (req, res) => {
  try {
    const { friendId, paidBy, category, description, amount, date } = req.body;
    const user = await User.findById(friendId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const friends = [friendId, paidBy];
    const members = await User.find({ _id: { $in: friends } }).lean();
    const membersBalance = calculateSplit(paidBy, members, amount);

    const expense = new FriendExpense({
      description, amount, category, date,
      friend: friendId, paidBy, membersBalance, settledMembers: []
    });

    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    handleErrors(res, error);
  }
});

// Get Group Expenses by Member ID
router.get("/group/:groupId/member/:memberId", async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const expenses = await GroupExpense.find({ group: groupId }).populate("paidBy", { name: 1, _id: 1 });

    const filterExpenses = (filterFunc) => expenses.filter(filterFunc);

    const activeExpenses = filterExpenses(expense => (
      expense.approvedBalance.indexOf(memberId) === -1 &&
      !expense.isApproved &&
      expense.settledMembers.indexOf(memberId) === -1 &&
      !expense.isSettled
    ));

    const approvedExpenses = filterExpenses(expense => (
      expense.approvedBalance.indexOf(memberId) > -1 ||
      (expense.isApproved &&
        expense.settledMembers.indexOf(memberId) === -1 &&
        !expense.isSettled)
    ));

    const settledExpenses = filterExpenses(expense => (
      expense.settledMembers.indexOf(memberId) > -1 || expense.isSettled
    ));

    res.json({ activeExpenses, approvedExpenses, settledExpenses });
  } catch (error) {
    handleErrors(res, error);
  }
});

// Get Group Expenses by Date
router.post("/getGroupExpenseBydate", async (req, res) => {
  try {
    const { frequency, selectedDate, type, userid } = req.body;
    const dateQuery = frequency !== "custom"
      ? { date: { $gt: moment().subtract(Number(frequency), "d").toDate() } }
      : { date: { $gte: selectedDate[0], $lte: selectedDate[1] } };

    const expenses = await GroupExpense.find({
      ...dateQuery,
      group: userid,
      ...(type !== "all" && { type }),
    });

    res.status(200).json(expenses);
  } catch (error) {
    handleErrors(res, error);
  }
});

// Get Friend Expenses by Date
router.post("/getFriendExpenseBydate", async (req, res) => {
  try {
    const { frequency, selectedDate, type, userid } = req.body;
    const dateQuery = frequency !== "custom"
      ? { date: { $gt: moment().subtract(Number(frequency), "d").toDate() } }
      : { date: { $gte: selectedDate[0], $lte: selectedDate[1] } };

    const expenses = await FriendExpense.find({
      ...dateQuery,
      $or: [{ friend: userid }, { paidBy: userid }],
      ...(type !== "all" && { type }),
    });

    res.status(200).json(expenses);
  } catch (error) {
    handleErrors(res, error);
  }
});

// Get Friend Expenses
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const expenses = await FriendExpense.find({
      $or: [{ friend: userId }, { paidBy: userId }],
    })
      .populate("paidBy", { name: 1, _id: 1 })
      .populate("friend", { name: 1, _id: 1 });

    const activeExpenses = expenses.filter(expense => (
      expense.settledMembers.indexOf(userId) === -1 && !expense.isSettled
    ));

    const settledExpenses = expenses.filter(expense => (
      expense.settledMembers.indexOf(userId) > -1 || expense.isSettled
    ));

    res.json({ activeExpenses, settledExpenses });
  } catch (error) {
    handleErrors(res, error);
  }
});

// Helper function to update expense status
const updateExpenseStatus = async (req, res, model, action) => {
  try {
    const { expenseId, memberId } = req.params;
    if (!expenseId || !memberId) return res.status(400).json({ message: "No id received" });

    const expense = await model.findById(expenseId);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    const index = expense.settledMembers.indexOf(memberId);
    if (index > -1) {
      expense.settledMembers.splice(index, 1);
    } else {
      expense.settledMembers.push(memberId);
    }

    const totalMembers = expense.membersBalance.filter(
      member => member.memberId.toString() !== expense.paidBy.toString()
    ).length;

    expense.isSettled = action === "settle"
      ? expense.settledMembers.length === totalMembers
      : expense.settledMembers.length !== totalMembers;

    await expense.save();
    res.json(expense);
  } catch (error) {
    handleErrors(res, error);
  }
};

// Settle/Revert Group Expense
router.post("/:expenseId/:action(settle|revert)/:memberId", async (req, res) => {
  const { expenseId, memberId, action } = req.params;
  await updateExpenseStatus(req, res, GroupExpense, action);
});

// Settle/Revert Friend Expense
router.post("/:expenseId/friend:action(settle|revert)/:memberId", async (req, res) => {
  const { expenseId, memberId, action } = req.params;
  await updateExpenseStatus(req, res, FriendExpense, action);
});

// Approve Group Expense
router.post("/:expenseId/approve/:memberId", async (req, res) => {
  try {
    const { expenseId, memberId } = req.params;
    if (!expenseId || !memberId) return res.status(400).json({ message: "No id received" });

    const expense = await GroupExpense.findById(expenseId);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    const index = expense.approvedBalance.indexOf(memberId);
    if (index > -1) {
      expense.approvedBalance.splice(index, 1);
    } else {
      expense.approvedBalance.push(memberId);
    }

    const totalMembers = expense.membersBalance.filter(
      member => member.memberId.toString() !== expense.paidBy.toString()
    ).length;

    expense.isApproved = expense.approvedBalance.length === totalMembers;

    await expense.save();
    res.json(expense);
  } catch (error) {
    handleErrors(res, error);
  }
});

// Simplify Debts
router.get("/simplify/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!groupId) return res.status(400).json({ message: "No id received" });

    const expenses = await GroupExpense.find({ group: groupId });
    if (!expenses.length) return res.status(200).json({ message: "Expense list is empty" });

    const newExpenses = expenses.map(expense => ({
      payer: expense.paidBy,
      participants: expense.membersBalance.map(member => member.memberId),
      amount: expense.amount,
    }));

    const simplifiedDebts = simplifyDebts(newExpenses);
    res.status(200).json(simplifiedDebts);
  } catch (error) {
    handleErrors(res, error);
  }
});

module.exports = router;
