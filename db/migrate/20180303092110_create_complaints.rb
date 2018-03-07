class CreateComplaints < ActiveRecord::Migration[5.1]
  def change
    create_table :complaints, &:timestamps
  end
end
